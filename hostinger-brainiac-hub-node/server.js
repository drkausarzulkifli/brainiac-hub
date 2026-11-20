const express = require('express');
const path = require('node:path');
const app = express();
app.disable('x-powered-by');
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');next()});
app.get('/health', (req,res)=>res.json({status:'ok',app:'Brainiac Hub'}));
app.use(express.static(path.join(__dirname,'public'),{dotfiles:'deny',etag:true,maxAge:0}));
app.use((req,res)=>res.status(404).type('text').send('Not found'));
if(require.main===module){const port=Number(process.env.PORT)||3000;app.listen(port,'0.0.0.0',()=>console.log('Brainiac Hub listening on port '+port))}
module.exports=app;
