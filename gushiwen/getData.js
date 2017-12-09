const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');
const async = require("async");
const mongoose = require("mongoose");
const q = require('q');

let getBookData = require('./getBookData')

let options = {
    server: { poolSize: 5 }
}
mongoose.Promise = q.Promise;
let conno = mongoose.createConnection('mongodb://47.52.115.169/guwen',options);
mongoose.connection.on('connected', function () {
    console.log("远程数据库 连接成功");
})
let bookMap = mongoose.Schema({
    dbName: String,
    bookName: String,
    bookUrl: String,
    bookDetail: String,
})
let bookListModel = conno.model('booklists', bookMap);
let bookList = new bookListModel();
// let bookList = mongoose.model('booklists', bookMap);

//测试数据
 let arr = [
        // {
        //     bookUrl:'http://so.gushiwen.org/guwen/book_31.aspx',
        //     dbName:'guwenbook21'
        // },
        // {
        //     bookUrl:'http://so.gushiwen.org/guwen/book_68.aspx',
        //     dbName:'guwenbook26'
        // },
        {
            bookUrl:'http://so.gushiwen.org/guwen/book_62.aspx',
            dbName:'guwenbook39',
            bookName:'贞观政要'
        }
    ]

bookListModel.find({}, function (err, data) {
    if (err) {
        console.log('查询失败');
        return
    }
    console.log('当前需要爬取 ' + data.length + ' 项');
    async.mapLimit(data,1,function(series, callback){
        //真实环境
        console.log('主线程开始爬取  ' + series.bookName + '----------');
        let doc = series._doc;
        getBookData.init(doc.bookUrl,doc.bookName, doc.dbName,callback)
        
        //测试数据
        // let doc = series;
        // getBookData.init(doc.bookUrl,doc.bookName,doc.dbName,callback)
    },function(err,result){
        if(err){
            console.log(err);
        }
        let a = result;
        console.log('数据爬去完毕！')
    })
});



