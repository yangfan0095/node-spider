// 读取保存好的jsonString文件
var fs = require('fs');

// var rs = fs.createReadStream('shiji.txt');
fs.readFile( __dirname +'/史记.txt','utf-8',function(err, data){
    if(err){
        console.log(err);
        return 
    }
    var shiji = JSON.parse(data);

    console.log(shiji)
})

