from starlette.responses import JSONResponse


class RequestSizeLimit:
    """Bound actual streamed bodies even when Content-Length is omitted."""
    def __init__(self,app,max_bytes):
        self.app,self.max_bytes=app,max_bytes

    async def __call__(self,scope,receive,send):
        if scope['type']!='http' or scope['method'] not in ['POST','PUT','PATCH','DELETE']:
            return await self.app(scope,receive,send)
        messages=[];total=0
        while True:
            message=await receive()
            if message['type']=='http.disconnect':return
            total+=len(message.get('body',b''))
            if total>self.max_bytes:
                return await JSONResponse({'detail':'Request is too large'},413,headers={'Cache-Control':'no-store'})(scope,receive,send)
            messages.append(message)
            if not message.get('more_body',False):break
        position=0
        async def replay():
            nonlocal position
            if position<len(messages):
                message=messages[position];position+=1;return message
            return await receive()
        await self.app(scope,replay,send)
