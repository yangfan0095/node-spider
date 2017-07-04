var request = require('request');
var cheerio = require('cheerio');
var fs = require('fs');
var async = require("async");

var origin = 'http://so.gushiwen.org';
var website = 'http://so.gushiwen.org/guwen/book_5.aspx';


var bookUrl = [];
var bookChapter = [];
var bookName = '';
var book;
var getUrl = function () {
    request(website, function (err, response, body) {
        var $, bookUrl = [], bookChapter = [];
        if (err) {
            console.log(err);
        }
        if (response && response.statusCode == 200) {

            $ = cheerio.load(body, { decodeEntities: false });
            bookName = $('.cont h1').text();
            $('.bookcont').map(function (i, el) {
                var $me, item;
                $me = $(this);
                console.log($(el).html())
                item = {
                    chapter: $(el).find('strong').text(),
                    list: getListUrl($, el),
                    content:''
                }

                bookUrl.push(item)

            })


        }
        book = {
            name:bookName,
            chapterUrl:bookUrl
        }
        // book =  JSON.stringify(book)
        var newBook  =  getChapter(book);
        // book =  JSON.stringify(book)
        //  writeFile(book,bookName)

    })
}

getUrl();
var getListUrl = function ($, selector) {
    var arr = [];
    $(selector).find('div a').map(function (i, el) {
        var obj = {
            title: $(el).text(),
            url: origin + $(el).attr('href')
        }
        arr.push(obj)
    })
    return arr
}

var writeFile = function (data,fileName) {
    fs.writeFile(fileName + '.txt', data, function (err) {
        if (err) {
            console.log(err);
        } else {
            console.log('ok.');
        }
    });


}

function sleep(numberMillis) {
  var now = new Date();
  var exitTime = now.getTime() + numberMillis;
  while (true) {
    now = new Date();
    if (now.getTime() > exitTime)
      return;
  }
}

//获取每一章节内容
var bookJson = {
    content:[]
}
var length = 0,curBookName = 'shiji';
var getChapter = function(obj){
    length = obj.chapterUrl.length;
    obj.chapterUrl.forEach(function(item,i){
       async.mapLimit(item.list,3,function(series,callback){

           //sleep  可以加上sleep 函数 做时间延迟
            getArticle(series,callback)
        },function(err,result){
            console.log('-------数据抓取成功----------');
            console.log('当前抓取第 ' + bookJson.content.length + '项，总共 ' +length + '项数据' )
            bookJson.content.push({
                title:result[0].titleName,
                content:result
            })
            if(bookJson.content.length  === length){
                writeFile(JSON.stringify(bookJson),curBookName)
            }        
        })

    }) 
    
}


var getArticle = function(series,callback){
    request(series.url,function(err, response, body){
         if (err) {
            console.log('抓取数据失败,重新抓取')
            console.log(err);
            // getArticle(series,callback)
        };
        var $ = cheerio.load(body,{ decodeEntities: false });
        var obj = {
            titleName:series.title,
            title:$('.cont').find('h1').text(),
            author:$('.left .source a').text(),
            translator:$('.right .source span').eq(1).text(),
            content:$('.left .contson ').html(),
            translate:$('.right .shisoncont').html(),
        }
        console.log('正在抓取当前数据   ' + series.title + ' ---' )
        
        callback(null,obj)
    })
}