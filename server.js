const io = require('socket.io')({
  cors: {
    origin: ['http://localhost:3000','http://localhost:3002','http://192.168.101.53:3000']
  }
});
const userIdMap={}
io.on('connection', socket => {
    console.log(333,socket.handshake?.auth)
    const user = socket.handshake?.auth?.user
    if(user){
        userIdMap[user]=socket.id
        console.log(user+'连接成功')
    }
    
  socket.on('message', (res) => {
      console.log(userIdMap[res.to])
      io.to(userIdMap[res.to]).emit('message',res)
  });

  socket.on('disconnect', () => {
    console.log(`disconnect: ${socket.id}`);
  });
});

io.listen(9001);

// setInterval(() => {
//   io.emit('message', new Date().toISOString());
// }, 5000);
