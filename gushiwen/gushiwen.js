var request = require('request');
var cheerio = require('cheerio');
var fs = require('fs');
var async = require("async");
var mongoose = require("mongoose");
var q = require('q');

mongoose.Promise = q.Promise;
mongoose.connect('mongodb://localhost:27017/gushiwen2');
mongoose.connection.on('connected', function () {
    console.log("数据库 连接成功");
})

var bookItem = mongoose.Schema({
    name: String,
    author: String,
    chapter: String,

    content: String,
    title: String,
    translator: String,
    translate:String,
    originUrl:String,
})

var chapterItem = mongoose.model('chapterItem', bookItem);
var origin = 'http://so.gushiwen.org';
var website = 'http://so.gushiwen.org/guwen/book_5.aspx';


var bookUrl = [];
var bookChapter = [];
var bookName = '';
var book;

// 获取 二级即 章节分类
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
                item = {
                    chapter: $(el).find('strong').text(),
                    list: getListUrl($, el),
                    content: ''
                }

                bookUrl.push(item)

            })


        }
        book = {
            name: bookName,
            author: '司马迁',
            chapterUrl: bookUrl
        }
        // book =  JSON.stringify(book)
        getChapter(book);
        // saveSecCategorg(book)
        // book =  JSON.stringify(book)
        //  writeFile(book,bookName)

    })
}

getUrl();




var saveSecCategorg = function (book) {
    book.chapterUrl.forEach(function (item, index) {

        item.list.forEach(function (childItem, index) {
            var obj = {
                name: book.name,
                author: book.author,
                chapter: item.chapter,
                content: '',
                title: childItem.title,
                url: childItem.url
            }
            var bookModel = new chapterItem(obj);

            bookModel.save(function (err) {
                if (err) {
                    console.log(err)
                    return
                }
                console.log(item.chapter + '' + childItem.title + '  保存到数据库成功!')
            })
        })

    })
}

// 
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

var writeFile = function (data, fileName) {
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
    content: []
}
var length = 0, curBookName = 'shiji';
var getChapter = function (obj) {
    length = obj.chapterUrl.length;
    obj.chapterUrl.forEach(function (item, i) {
        async.mapLimit(item.list, 3, function (series, callback) {

            //sleep  可以加上sleep 函数 做时间延迟
            getArticle(series, callback)
        }, function (err, result) {
            console.log('-------数据抓取成功----------');
            console.log('当前抓取第 ' + bookJson.content.length + '项，总共 ' + length + '项数据')
            bookJson.content.push({
                title: result[0].titleName,
                content: result
            })
            //爬取数据结束
            if (bookJson.content.length === length) {
                // writeFile(JSON.stringify(bookJson), curBookName)
                console.log('----爬取结束----')
                console.log('--总条数：' + length + '项')
            }
        })

    })

}

// 替换为本正则匹配
var replaceFront = {
    reg:/<p.*?>/g ,
    replace:''
};
var replaceEnd = {
    reg:/<\/p.*?>/g,
    replace:'<br/>'
}
var getArticle = function (series, callback) {
    request(series.url, function (err, response, body) {
        if (err) {
            console.log('抓取数据失败,重新抓取')
            console.log(err);
            // getArticle(series,callback)
        };
        var $ = cheerio.load(body, { decodeEntities: false });
        //获取当前二级标题和三级标题
        var curChapter = $('.cont').find('h1').html().replace(/<[^>].*>/g,'').trim();
        var curChapter = curChapter.split('·');
        var obj = {
            name:book.name,
            author:book.author,
            chapter:curChapter[0],
            title: curChapter[1],
            translator: $('.right .source span').eq(1).text(),
            content: $('.contson').html() ? reg($('.contson').html(),replaceFront.reg,replaceFront.replace,curChapter[1]).replace(replaceEnd.reg,replaceEnd.replace) :noResourceNotice(series.url,curChapter,'没有内容') ,
            translate:$('.shisoncont').html() ? reg($('.shisoncont').html(),replaceFront.reg,replaceFront.replace).replace(replaceEnd.reg,replaceEnd.replace).replace(/<[^>|^br].*?>/g,'') : noResourceNotice(series.url,curChapter,' 没有翻译'),
            originUrl:series.url
    }
        saveMongo(obj);
        console.log('正在抓取当前数据   ' + series.title + ' ---')

        callback(null,obj)
    })
}


var replaceStr = function(str,reg,replace){
    if(!str){
        return
    }
    return  reg(str,replaceFront.reg,replaceFront.replace,curChapter[1]).replace(replaceEnd.reg,replaceEnd.replace)

}

var noResourceNotice = function(url,title ,detail){
    console.log('当前项：' + title +'  ' +  detail + '  url :' + url );
    return ''  
}

// dom 操作函数
var  domOpreate = function(str){
    if(!str){
        return ''
    }else{

    }
}





//正则替换
var reg = function(str,reg,replace,flag){
    if(!str){
        console.log(flag + ' 项没有数据')
        return
    }else{
        return str.replace(reg,replace)
    }
    
}

var saveMongo = function(obj){
    
            var bookModel = new chapterItem(obj);

            bookModel.save(function (err) {
                if (err) {
                    console.log(err)
                    return
                }
                console.log(obj.chapter + '' + obj.title + '  保存到数据库成功!')
            })
}

//曲线救国 正则表达式 
//var aaa = data.replace(/<p.*?>/g,"")
//var aaa = data.replace(/<\/p.*?>/g,"/n")

// var replaceFront = {
//     reg:/<p.*?>/g ,
//     replace:''
// };
// var replaceEnd = {
//     reg:/<\/p.*?>/g,
//     replace:'\\n'
// }
// var reg = function(str,reg,replace,callback){
//     return str.replace(reg,replace)
// }
// var content = reg($('.shisoncont').html(),replaceFront.reg,replaceFront.replace).replace(replaceEnd.reg,replaceEnd.replace);
// var ddd = content.replace(/<[^>|^br].*?>/g,'')