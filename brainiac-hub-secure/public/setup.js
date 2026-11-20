document.querySelector('#setup-form').addEventListener('submit',async e=>{
 e.preventDefault();const button=e.target.querySelector('button'),message=document.querySelector('#setup-message');button.disabled=true;message.textContent='Memproses…';
 try{const fields=Object.fromEntries(new FormData(e.target));if(fields.password!==fields.confirm)throw Error('Pengesahan kata laluan tidak sepadan.');delete fields.confirm;
 const sessionResponse=await fetch('/api.php?action=session',{cache:'no-store'});const session=await sessionResponse.json();if(!sessionResponse.ok)throw Error(session.error);
 const response=await fetch('/api.php?action=setup',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify(fields)});const result=await response.json();if(!response.ok)throw Error(result.error);
 e.target.reset();message.textContent='Admin berjaya dicipta. Anda boleh log masuk sekarang.';button.hidden=true;
 }catch(err){message.textContent=err.message}finally{button.disabled=false}
});
