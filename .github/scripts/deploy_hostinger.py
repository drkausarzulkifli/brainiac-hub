#!/usr/bin/env python3
"""Deploy Brainiac Hub files to Hostinger over Explicit FTPS.

Safely handles:
- Auto-detecting the Hostinger FTP account root layout.
- Removing any accidental nested `public_html/public_html/` directory.
- Uploading `brainiac-hub-secure/public/` (including `.htaccess`) to `public_html/`.
- Updating `brainiac-private/bootstrap.php`, `schema.sql`, `config.example.php`,
  and `.htaccess` without ever touching or deleting `brainiac-private/config.php`.
"""

from __future__ import annotations

import ftplib
import os
import posixpath
import ssl
import sys
import time
from pathlib import Path


WEB_MARKERS = {
    'api.php',
    'index.html',
    'setup.html',
    'default.php',
    '.ftp-deploy-sync-state.json',
    'app.js',
    'auth.js',
}

PRIVATE_ALLOWLIST = [
    '.htaccess',
    'bootstrap.php',
    'config.example.php',
    'schema.sql',
]

TRANSIENT_ERRORS = (
    EOFError,
    ConnectionResetError,
    BrokenPipeError,
    TimeoutError,
    ssl.SSLError,
    OSError,
    ftplib.error_temp,
)


class HostingerFTP_TLS(ftplib.FTP_TLS):
    """FTP_TLS supporting optional TLS session reuse and safe data unwrap."""

    def __init__(self, *args, reuse_session: bool = True, **kwargs):
        self.reuse_session = reuse_session
        super().__init__(*args, **kwargs)

    def ntransfercmd(self, cmd: str, rest=None):
        conn, size = ftplib.FTP.ntransfercmd(self, cmd, rest)
        if self._prot_p:
            wrap_kwargs = {'server_hostname': self.host}
            if (
                self.reuse_session
                and isinstance(self.sock, ssl.SSLSocket)
                and self.sock.session is not None
            ):
                wrap_kwargs['session'] = self.sock.session
            conn = self.context.wrap_socket(conn, **wrap_kwargs)
        return conn, size

    def storbinary(self, cmd, fp, blocksize=8192, callback=None, rest=None):
        self.voidcmd('TYPE I')
        with self.transfercmd(cmd, rest) as conn:
            while True:
                buf = fp.read(blocksize)
                if not buf:
                    break
                conn.sendall(buf)
                if callback:
                    callback(buf)
            if isinstance(conn, ssl.SSLSocket):
                old_timeout = conn.gettimeout()
                try:
                    conn.settimeout(3.0)
                    conn.unwrap()
                except (ssl.SSLError, OSError):
                    pass
                finally:
                    try:
                        conn.settimeout(old_timeout)
                    except OSError:
                        pass
        return self.voidresp()

    def retrlines(self, cmd, callback=None):
        if callback is None:
            callback = ftplib.print_line
        self.sendcmd('TYPE A')
        with self.transfercmd(cmd) as conn, conn.makefile('r', encoding=self.encoding) as fp:
            while True:
                line = fp.readline(self.maxline + 1)
                if len(line) > self.maxline:
                    raise ftplib.Error(f'got more than {self.maxline} bytes')
                if not line:
                    break
                if line.endswith('\r\n'):
                    line = line[:-2]
                elif line.endswith('\n'):
                    line = line[:-1]
                callback(line)
            if isinstance(conn, ssl.SSLSocket):
                old_timeout = conn.gettimeout()
                try:
                    conn.settimeout(3.0)
                    conn.unwrap()
                except (ssl.SSLError, OSError):
                    pass
                finally:
                    try:
                        conn.settimeout(old_timeout)
                    except OSError:
                        pass
        return self.voidresp()


def make_ssl_context(tls12_only: bool) -> ssl.SSLContext:
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    if tls12_only:
        ctx.maximum_version = ssl.TLSVersion.TLSv1_2
    return ctx


def parse_host(raw_server: str) -> str:
    host = raw_server.strip()
    for prefix in ('ftps://', 'ftp://'):
        if host.lower().startswith(prefix):
            host = host[len(prefix):]
    return host.rstrip('/')


def is_remote_dir(ftp: HostingerFTP_TLS, path: str) -> bool:
    prev = ftp.pwd()
    try:
        ftp.cwd(path)
        return True
    except ftplib.error_perm:
        return False
    finally:
        try:
            ftp.cwd(prev)
        except ftplib.all_errors:
            pass


def list_dir(ftp: HostingerFTP_TLS, remote_dir: str, resolve_links: bool = False) -> dict[str, str]:
    """Return {entry_name: 'dir'|'file'|'link'} including hidden dotfiles."""
    entries: dict[str, str] = {}
    used_mlsd = False
    try:
        for name, facts in ftp.mlsd(remote_dir):
            if name in ('.', '..'):
                continue
            ftype = (facts.get('type') or '').lower()
            if ftype in ('cdir', 'pdir'):
                continue
            if ftype == 'dir':
                entries[name] = 'dir'
            elif 'slink' in ftype or 'symlink' in ftype:
                entries[name] = 'link'
            else:
                entries[name] = 'file'
        used_mlsd = True
    except ftplib.error_perm:
        pass

    if not used_mlsd:
        prev_pwd = ftp.pwd()
        try:
            ftp.cwd(remote_dir)
            lines: list[str] = []
            try:
                ftp.retrlines('LIST -a', lines.append)
            except ftplib.error_perm:
                lines.clear()
                ftp.retrlines('LIST', lines.append)
            for line in lines:
                if not line or line.startswith('total '):
                    continue
                parts = line.split(None, 8)
                if len(parts) < 9:
                    continue
                perms, name = parts[0], parts[8]
                if perms.startswith('l') and ' -> ' in name:
                    name = name.split(' -> ', 1)[0]
                if name in ('.', '..'):
                    continue
                if perms.startswith('d'):
                    entries[name] = 'dir'
                elif perms.startswith('l'):
                    entries[name] = 'link'
                else:
                    entries[name] = 'file'
        finally:
            try:
                ftp.cwd(prev_pwd)
            except ftplib.all_errors:
                pass

    if resolve_links:
        for name, typ in list(entries.items()):
            if typ == 'link':
                target = posixpath.join(remote_dir, name)
                entries[name] = 'dir' if is_remote_dir(ftp, target) else 'file'

    return entries


class FTPSession:
    def __init__(self, host: str, port: int, user: str, password: str):
        self.host = host
        self.port = port
        self.user = user
        self.password = password
        self.mode: tuple[bool, bool] | None = None  # (tls12_only, reuse_session)
        self.ftp: HostingerFTP_TLS | None = None
        self.initial_pwd: str = '/'

    def _open_with_mode(self, tls12_only: bool, reuse_session: bool) -> HostingerFTP_TLS:
        ctx = make_ssl_context(tls12_only=tls12_only)
        ftp = HostingerFTP_TLS(context=ctx, reuse_session=reuse_session, timeout=30)
        ftp.connect(self.host, self.port, timeout=30)
        ftp.login(self.user, self.password)
        ftp.prot_p()
        ftp.set_pasv(True)
        return ftp

    def connect(self) -> None:
        if self.mode is not None:
            self.ftp = self._open_with_mode(*self.mode)
            self.initial_pwd = self.ftp.pwd() or '/'
            return

        modes = [
            (True, True),    # TLS 1.2 + data session reuse (Pure-FTPd standard)
            (False, True),   # Auto TLS + data session reuse
            (False, False),  # Auto TLS without forced session reuse
        ]
        last_err: Exception | None = None
        for tls12_only, reuse_session in modes:
            ftp = None
            try:
                ftp = self._open_with_mode(tls12_only, reuse_session)
                pwd = ftp.pwd() or '/'
                list_dir(ftp, pwd)
                self.mode = (tls12_only, reuse_session)
                self.ftp = ftp
                self.initial_pwd = pwd
                print(
                    f'Connected via Explicit FTPS (mode tls12_only={tls12_only}, '
                    f'reuse_session={reuse_session}, initial_pwd={pwd})'
                )
                return
            except ftplib.error_perm as exc:
                if ftp:
                    try:
                        ftp.close()
                    except OSError:
                        pass
                if str(exc).startswith('530'):
                    raise RuntimeError('FTP authentication failed (530 Login incorrect).') from exc
                last_err = exc
            except Exception as exc:  # noqa: BLE001
                if ftp:
                    try:
                        ftp.close()
                    except OSError:
                        pass
                last_err = exc
        raise RuntimeError(f'Unable to establish FTPS data connection: {last_err}')

    def reconnect(self) -> None:
        if self.ftp:
            try:
                self.ftp.close()
            except OSError:
                pass
            self.ftp = None
        self.connect()

    def close(self) -> None:
        if self.ftp:
            try:
                self.ftp.quit()
            except Exception:  # noqa: BLE001
                try:
                    self.ftp.close()
                except OSError:
                    pass
            self.ftp = None

    def run(self, fn):
        for attempt in range(1, 4):
            try:
                assert self.ftp is not None
                return fn(self.ftp)
            except ftplib.error_perm:
                raise
            except TRANSIENT_ERRORS as exc:
                if attempt == 3:
                    raise
                print(f'Transient FTP error ({type(exc).__name__}: {exc}); retrying ({attempt}/3)...')
                time.sleep(1.5 * attempt)
                self.reconnect()


def ensure_dir(session: FTPSession, remote_dir: str, created_cache: set[str]) -> None:
    norm = posixpath.normpath(remote_dir)
    if norm in ('', '/', '.') or norm in created_cache:
        return
    parts = [p for p in norm.split('/') if p]
    cur = '/' if norm.startswith('/') else ''
    for part in parts:
        cur = posixpath.join(cur, part) if cur else part
        if cur in created_cache:
            continue

        def _ensure(ftp: HostingerFTP_TLS, target: str = cur) -> None:
            try:
                ftp.cwd(target)
            except ftplib.error_perm:
                ftp.mkd(target)
                ftp.cwd(target)
            finally:
                ftp.cwd(session.initial_pwd)

        session.run(_ensure)
        created_cache.add(cur)


def remove_tree(session: FTPSession, remote_dir: str) -> None:
    norm = posixpath.normpath(remote_dir)
    if norm in ('/', '.', ''):
        raise ValueError(f'Refusing to delete unsafe directory: {remote_dir}')

    entries = session.run(lambda ftp: list_dir(ftp, norm))
    for name, typ in sorted(entries.items()):
        child = posixpath.join(norm, name)
        if typ == 'dir':
            remove_tree(session, child)
        else:
            session.run(lambda ftp, p=child: ftp.delete(p))

    def _rmd(ftp: HostingerFTP_TLS) -> None:
        try:
            ftp.rmd(norm)
        except ftplib.error_perm:
            # Pure-FTPd may still fail RMD if hidden dotfiles were omitted by LIST.
            for dotname in ('.htaccess', '.ftp-deploy-sync-state.json', '.DS_Store'):
                try:
                    ftp.delete(posixpath.join(norm, dotname))
                except ftplib.error_perm:
                    pass
            ftp.rmd(norm)

    session.run(_rmd)


def upload_file(session: FTPSession, local_path: Path, remote_path: str) -> None:
    if local_path.name == 'config.php' or remote_path.endswith('/config.php'):
        raise AssertionError('Refusing to overwrite config.php')

    def _stor(ftp: HostingerFTP_TLS) -> None:
        with local_path.open('rb') as fp:
            ftp.storbinary(f'STOR {remote_path}', fp)

    session.run(_stor)


def detect_layout(session: FTPSession) -> tuple[str, str | None, str]:
    """Detect (web_dir, private_dir, description) relative to initial_pwd."""
    pwd = session.initial_pwd
    root_entries = session.run(lambda ftp: list_dir(ftp, pwd, resolve_links=True))
    print('FTP root entries:', sorted(root_entries.keys()))

    # Case 1a: Account home directory containing domains/brainiachub.io/
    if root_entries.get('domains') == 'dir':
        domains_dir = posixpath.join(pwd, 'domains')
        domains_entries = session.run(lambda ftp: list_dir(ftp, domains_dir, resolve_links=True))
        print(f'FTP {domains_dir} entries:', sorted(domains_entries.keys()))
        if domains_entries.get('brainiachub.io') == 'dir':
            base = posixpath.join(domains_dir, 'brainiachub.io')
            return (
                posixpath.join(base, 'public_html'),
                posixpath.join(base, 'brainiac-private'),
                f'account root ({base})',
            )

    # Probe parent directory once when starting inside a subdirectory such as /public_html
    parent_info: dict[str, object] = {'parent': None, 'entries': {}, 'domain_base': None}

    def _probe_parent(ftp: HostingerFTP_TLS) -> dict[str, object]:
        info: dict[str, object] = {'parent': None, 'entries': {}, 'domain_base': None}
        try:
            ftp.cwd(pwd)
            ftp.cwd('..')
            parent = ftp.pwd() or '/'
            if parent != pwd:
                info['parent'] = parent
                try:
                    p_entries = list_dir(ftp, parent, resolve_links=True)
                    info['entries'] = p_entries
                    print(f'FTP parent ({parent}) entries:', sorted(p_entries.keys()))
                    if p_entries.get('domains') == 'dir':
                        domains_dir = posixpath.join(parent, 'domains')
                        domains_entries = list_dir(ftp, domains_dir, resolve_links=True)
                        print(f'FTP {domains_dir} entries:', sorted(domains_entries.keys()))
                        if domains_entries.get('brainiachub.io') == 'dir':
                            info['domain_base'] = posixpath.join(domains_dir, 'brainiachub.io')
                except ftplib.error_perm as exc:
                    print(f'Note: could not list parent ({parent}): {exc}')
        except ftplib.all_errors:
            pass
        finally:
            try:
                ftp.cwd(pwd)
            except ftplib.all_errors:
                pass
        return info

    in_named_public_html = posixpath.basename(pwd.rstrip('/')) == 'public_html'
    if in_named_public_html or any(marker in root_entries for marker in WEB_MARKERS):
        parent_info = session.run(_probe_parent)
        domain_base = parent_info['domain_base']
        if isinstance(domain_base, str):
            return (
                posixpath.join(domain_base, 'public_html'),
                posixpath.join(domain_base, 'brainiac-private'),
                f'domain folder via parent ({domain_base})',
            )

        # Case 2: FTP account starts directly inside the site's public_html/
        parent = parent_info['parent']
        private_dir = posixpath.join(parent, 'brainiac-private') if isinstance(parent, str) else None
        return (pwd, private_dir, 'public_html root')

    # Case 3: FTP account is rooted in domain root containing public_html/
    if root_entries.get('public_html') == 'dir' or root_entries.get('brainiac-private') == 'dir':
        return (
            posixpath.join(pwd, 'public_html'),
            posixpath.join(pwd, 'brainiac-private'),
            'domain root',
        )

    raise RuntimeError(
        'Could not determine Hostinger target layout from FTP root entries: '
        + ', '.join(sorted(root_entries.keys()))
    )


def main() -> int:
    raw_server = os.environ.get('FTP_SERVER', '')
    user = os.environ.get('FTP_USERNAME', '').strip()
    password = os.environ.get('FTP_PASSWORD', '')
    port = int(os.environ.get('FTP_PORT', '21') or '21')

    host = parse_host(raw_server)
    if not host or not user or not password:
        print('::error::Missing FTP_SERVER, FTP_USERNAME, or FTP_PASSWORD environment variables.')
        return 1

    repo_root = Path(__file__).resolve().parents[2]
    secure_root = repo_root / 'brainiac-hub-secure'
    local_public = secure_root / 'public'
    local_private = secure_root / 'brainiac-private'

    if not (local_public / 'index.html').is_file() or not (local_public / 'api.php').is_file():
        print(f'::error::Expected public files missing under {local_public}')
        return 1
    if not (local_public / '.htaccess').is_file():
        print(f'::error::Missing .htaccess under {local_public}')
        return 1
    for name in PRIVATE_ALLOWLIST:
        if not (local_private / name).is_file():
            print(f'::error::Missing required private file: {local_private / name}')
            return 1

    session = FTPSession(host=host, port=port, user=user, password=password)
    try:
        session.connect()
        web_dir, private_dir, layout_desc = detect_layout(session)
        print(f'Detected layout: {layout_desc} | web_dir={web_dir} | private_dir={private_dir}')

        dir_cache: set[str] = {'/', session.initial_pwd}
        anc = session.initial_pwd
        while anc not in ('', '/'):
            dir_cache.add(anc)
            anc = posixpath.dirname(anc)
        ensure_dir(session, web_dir, dir_cache)

        # 1. Remove nested public_html/public_html/ if present and clean old FTP-Deploy state file.
        web_entries = session.run(lambda ftp: list_dir(ftp, web_dir))
        nested_public = posixpath.join(web_dir, 'public_html')
        if web_entries.get('public_html') == 'dir':
            print(f'Removing nested duplicate directory: {nested_public}/')
            remove_tree(session, nested_public)
        elif web_entries.get('public_html') == 'file':
            print(f'Removing unexpected file named public_html in {web_dir}')
            session.run(lambda ftp: ftp.delete(nested_public))

        if web_entries.get('.ftp-deploy-sync-state.json') == 'file':
            stale_state = posixpath.join(web_dir, '.ftp-deploy-sync-state.json')
            print(f'Removing stale sync state file: {stale_state}')
            session.run(lambda ftp: ftp.delete(stale_state))

        # 2. Upload all public_html files.
        public_files = sorted(p for p in local_public.rglob('*') if p.is_file())
        print(f'Uploading {len(public_files)} files to {web_dir}/ ...')
        for local_file in public_files:
            rel = local_file.relative_to(local_public).as_posix()
            remote_file = posixpath.join(web_dir, rel)
            ensure_dir(session, posixpath.dirname(remote_file), dir_cache)
            upload_file(session, local_file, remote_file)
        print(f'Successfully updated {web_dir}/ ({len(public_files)} files).')

        # 3. Update brainiac-private/ (never touch config.php).
        if private_dir is None:
            print(
                '::error::Updated public_html/ and cleaned nested public_html/public_html/, '
                'but the FTP account is chrooted inside public_html/ and cannot access '
                '../brainiac-private/. In Hostinger hPanel -> Files -> FTP Accounts, set the '
                'FTP account directory to domains/brainiachub.io (parent of public_html) and '
                're-run this workflow so bootstrap.php and schema.sql can be updated.'
            )
            return 1

        try:
            ensure_dir(session, private_dir, dir_cache)
            priv_entries = session.run(lambda ftp: list_dir(ftp, private_dir))
            if 'config.php' in priv_entries:
                print(f'Preserving existing {private_dir}/config.php (untouched).')
            else:
                print(
                    f'::warning::{private_dir}/config.php was not found on the server. '
                    'Ensure database credentials are configured per PANDUAN-HOSTINGER.md.'
                )

            for name in PRIVATE_ALLOWLIST:
                assert name != 'config.php'
                local_file = local_private / name
                remote_file = posixpath.join(private_dir, name)
                upload_file(session, local_file, remote_file)
                print(f'Updated {remote_file}')
        except ftplib.error_perm as exc:
            print(
                f'::error::Updated {web_dir}/, but failed updating {private_dir}/ ({exc}). '
                'Verify that the FTP account has write access to domains/brainiachub.io/brainiac-private/.'
            )
            return 1

        print('Deployment to Hostinger completed successfully.')
        return 0
    finally:
        session.close()


if __name__ == '__main__':
    sys.exit(main())
