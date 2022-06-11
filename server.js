const Ws = require('ws')
const WsServer = Ws.Server
const server = new WsServer({ port: 8000 });

((server)=>{

    let onlineUserList = new Map([])
    let onlineUserCount = 0
    
    const init = () => {
        bindEvent()
    };
    const bindEvent = () => {
        server.on('connection',handleServerConnection);
        server.on('close',handleServerClose)
    };
    //关闭服务
    const handleServerClose = () =>{
        clearInterval(switchAlive);
    }
    //开启连接
    const handleServerConnection = (client) => {
        client.on('close',(e)=>{
            return handleClose(e,client)
        });
        client.on('message',(msg)=>{
           return handleMessage(msg,client)
        })
    };
    //一个客户端关闭
    const handleClose = (e,client) => {
        console.log('有一位用户主动或被动下线了，他的名字是：',client.username,'他的id是：',client.userid); 

        //更细颗粒度，需要在message里根据eventName做处理（比如 判断主动还是被动下线），所以这里只是log一下
        
    };

    const handleMessage = (msg,client) => {
        const message = JSON.parse(msg)
        
        // console.log(message);
        //用户上线
        if(message.eventName=='onLine'){
            client.userid = message.userid
            client.username = message.username
            client.isAlive = true
            if(!onlineUserList.has(message.userid)){
                onlineUserList.set( message.userid,{id:message.userid,name:message.username})   
            }           
            onlineUserCount = onlineUserList.size

            console.log('一位用户上线了,当前在线人数-->',onlineUserCount)
            console.log('当前在线信息-->',onlineUserList)
            //广播信息
            broadcast(server,message)
            //广播在线人员信息
            broadcastOnlineUsr(server)
            return
        }
        //用户下线
        else if(message.eventName=='outLine'){
            onlineUserList.delete(client.userid)
            onlineUserCount = onlineUserList.size
            client.isAlive = false
            client.terminate()
            console.log('一位用户下线了,当前在线人数-->',onlineUserCount)
            console.log('当前在线信息-->',onlineUserList)
            //广播信息
            broadcast(server,message)            
            //广播在线人员信息
            broadcastOnlineUsr(server)
            return
        }
        
        //公共聊天
        else if(message.eventName=='public'){
            client.isAlive = true
            broadcast(server,message)
            return
        }
        //私聊
        else if(message.eventName=='private'){
            client.isAlive = true
            privateChannel(server,message)
            return
        }
        //pong
        else if(message.eventName=='pong'){
            client.isAlive = true
            // client.isAlive = true
        }
        //heartbeat
        else if(message.eventName=='heartbeat'){
            //给对应的客户端回应heartbeat
            client.isAlive = true
            client.send(JSON.stringify({eventName:'heartbeat'}))
        }
             

    }

    //广播
    const broadcast = (service, content) => {
        service.clients.forEach(c=>{c.send(JSON.stringify(content))})
    }
    //广播在线用户信息
    const broadcastOnlineUsr = (service) => {
        const userList = []
        onlineUserList.forEach(v=>{
            userList.push(v)
        })
        const onLineUserInfo = {
            eventName: 'onLineUserInfo',
             userList: userList
        }
        service.clients.forEach(c=>{c.send(JSON.stringify(onLineUserInfo))})
    }
    //私聊
    const privateChannel = (service,content) =>{
        // console.log(content)
        const targetPersonId = content.to
        service.clients.forEach(v=>{
            if(v.userid==targetPersonId){
                v.send(JSON.stringify(content))
                return
            }
        })
    }

    //定时检测，切换状态
    //每过pingTime，设置客户端为broken，并发送ping(),
    //如果客户端返回pong(),证明连接正常，在监听的message事件里设置为对应事件所属客户端isAlive=true
    //如果客户端未返回信息，那么这个链接的状态已经是isAlive=false的，那么它会在下一个轮询周期（pingTime）被清理掉

    //发送ping消息的事件间隔 ms
    const pingTime = 1000*10 

    const switchAlive = () =>{
        
        return setInterval(()=>{
            //当前在线客户端userid
            const onlineClientList = []
            server.clients.forEach(c=>{
                //broken
                if(c.isAlive==false){
                    c.terminate()
                    onlineUserList.delete(c.userid)
                    onlineUserCount = onlineUserList.size
                    console.log('这里是switchAlive，一个客户端 被动 掉线了，他的id是++++',c.userid)

                    //广播信息
                    broadcast(server,{
                        userid: c.userid,
                        username: c.username,
                        eventName: 'outLine',
                        eventDesc: '网络问题'
                    })            
                    //广播在线人员信息
                    broadcastOnlineUsr(server)
                    return
                }
                //healthy
                c.isAlive = false
                c.send(JSON.stringify({eventName:'ping'}))
                onlineClientList.push(c.userid)
            })
            console.log('这里是switchAlive，当前在线客户端id列表为:',onlineClientList)

        },pingTime)
    }
    
    init()
    switchAlive()

})(server);