var request = require('request');
var cheerio = require('cheerio');
var fs = require('fs');
var async = require("async");
var mongoose = require("mongoose");
var q = require('q');

mongoose.Promise = q.Promise;
mongoose.connect('mongodb://localhost:27017/guwenBackUp');
mongoose.connection.on('connected', function () {
    console.log("数据库 连接成功");
})

//具体书内容表
var bookItem = mongoose.Schema({
    name: String,
    author: String,
    chapter: String,

    content: String,
    title: String,
    translator: String,
    translate: String,
    originUrl: String,
})

//建立一级书目，与数据库的映射关系
var bookMap = mongoose.Schema({
    dbName: String,
    bookName: String,
    bookUrl: String,
    bookDetail: String,
})

var chapterItem = mongoose.model('chapterItem', bookItem);
let bookModel = mongoose.model('bookList', bookMap);
var origin = 'http://so.gushiwen.org';
var website = 'http://so.gushiwen.org/guwen/book_5.aspx';

//所有基准url 
var baseUrl = 'http://so.gushiwen.org/guwen/Default.aspx?p=';
var totalListPage = 18;
var prefix = 'guwenbook';

// 每本书初始化， 1 首先保存成一个model ,  2 获取书的内容

//初始化
var init = function () {

    console.log('---------好戏开始，dang dang dang dang！--------')
    var pageUrlList = getPageUrlList(totalListPage, baseUrl);
    getBookList(pageUrlList)
}

// 得到当前总页数链接
var getPageUrlList = function (totalCount, baseUrl) {
    let pageUrlList = [];
    for (let i = 1; i <= totalCount; i++) {
        pageUrlList.push(baseUrl + i)
    }
    return pageUrlList

}

// 得到当前页 书籍一级信息
var getCurPage = function (bookUrl, callback) {
    request(bookUrl, function (err, response, body) {
        if (err) {
            console.log('当前链接发生错误，url地址为:' + bookUrl);
            callback(null, null)
            return
        } else {
            $ = cheerio.load(body, { decodeEntities: false });
            let curBookName = $('.sonspic h1').text();
            let curBookList = getCurPageBookList($, body);
            callback(null, curBookList)
        }


    })
}

//通过闭包 生成dbName  @prefix 输入前缀
var count = 0;
var getDBName = function (prefix) {
    return prefix + count++
}

//获取当前页 书籍内容保存在数组中
var getCurPageBookList = function ($, body) {
    let BookListDom = $('.sonspic .cont');
    let BookList = [];
    BookListDom.each(function (index, el) {
        let obj = {
            dbName: getDBName(prefix),
            bookName: $(el).find('p b').text(), // 书名
            bookUrl: origin + $(el).find('p a').attr('href'), //书目链接
            bookDetail: $(el).find('p').eq(1).text().trim(),// 书籍介绍
        }
        BookList.push(obj)
    })
    return BookList
}

//得到书籍具体信息
var getBookList = function (pageUrlList) {
    async.mapLimit(pageUrlList, 3, function (series, callback) {
        getCurPage(series, callback)
    }, function (err, result) {
        if (err) {
            console.log('------------异步执行出错!----------')
            return
        }
        getAllBookList(result);

    })

}
var saveDB = function (obj) {
    //严格这里应该加上类型判别 ，这里偷个懒  
    let dbModel = new bookModel(obj);
    dbModel.save(function (err) {
        if (err) {
            console.log(err)
            return
        }
        console.log(obj.bookName + '  数目一级内容保存到数据库成功!')
    })
}

var getAllBookList = function (Arr) {
    let a = Arr;
    Arr.forEach(function(Item,index){
        Item.forEach(function(obj,index){         
            saveDB(obj);
        })
    })
}


init();


/*
    获取具体书籍内容相关代码，初始化 getUrl()
*/


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

// getUrl();




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
    //批量获取详细篇幅 文章url ；
    $(selector).find('a').map(function (i, el) {
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
    reg: /<p.*?>/g,
    replace: ''
};
var replaceEnd = {
    reg: /<\/p.*?>/g,
    replace: '<br/>'
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
        var curChapter = $('.cont').find('h1').html().replace(/<[^>].*>/g, '').trim();
        var curChapter = curChapter.split('·');
        var obj = {
            name: book.name,
            author: book.author,
            chapter: curChapter[0],
            title: curChapter[1],
            translator: $('.right .source span').eq(1).text(),
            content: $('.contson').html() ? reg($('.contson').html(), replaceFront.reg, replaceFront.replace, curChapter[1]).replace(replaceEnd.reg, replaceEnd.replace) : noResourceNotice(series.url, curChapter, '没有内容'),
            translate: $('.shisoncont').html() ? reg($('.shisoncont').html(), replaceFront.reg, replaceFront.replace).replace(replaceEnd.reg, replaceEnd.replace).replace(/<[^>|^br].*?>/g, '') : noResourceNotice(series.url, curChapter, ' 没有翻译'),
            originUrl: series.url
        }
        saveMongo(obj);
        console.log('正在抓取当前数据   ' + series.title + ' ---')

        callback(null, obj)
    })
}


var replaceStr = function (str, reg, replace) {
    if (!str) {
        return
    }
    return reg(str, replaceFront.reg, replaceFront.replace, curChapter[1]).replace(replaceEnd.reg, replaceEnd.replace)

}

var noResourceNotice = function (url, title, detail) {
    console.log('当前项：' + title + '  ' + detail + '  url :' + url);
    return ''
}

// dom 操作函数
var domOpreate = function (str) {
    if (!str) {
        return ''
    } else {

    }
}





//正则替换
var reg = function (str, reg, replace, flag) {
    if (!str) {
        console.log(flag + ' 项没有数据')
        return
    } else {
        return str.replace(reg, replace)
    }

}

var saveMongo = function (obj) {

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