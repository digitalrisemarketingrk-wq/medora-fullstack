import {routes,type VercelConfig} from '@vercel/config/v1';

// BACKEND_URL is routing configuration. Provider credentials belong only on
// the FastAPI host and are never supplied as NEXT_PUBLIC_* variables.
const backend=process.env.BACKEND_URL?.replace(/\/$/,'');
if(process.env.NEXT_PUBLIC_DATA_MODE==='api'&&!backend){
  throw new Error('Set BACKEND_URL to the deployed FastAPI HTTPS origin before deploying API mode.');
}
if(backend){
  const url=new URL(backend);
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash){
    throw new Error('BACKEND_URL must be an HTTPS origin without credentials or a path.');
  }
}
export const config:VercelConfig={
  framework:null,
  installCommand:'corepack pnpm install --frozen-lockfile',
  buildCommand:'npm run build',
  outputDirectory:'dist/client',
  cleanUrls:true,
  trailingSlash:false,
  rewrites:backend?[routes.rewrite('/api/(.*)',backend+'/api/$1')]:[],
  headers:[
    {source:'/(.*)',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'X-Frame-Options',value:'DENY'}]},
  ],
};
