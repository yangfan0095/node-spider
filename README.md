 npm install 

  直接进入scrapy 运行guwenwang.js 吧

  其实nodeJs 爬虫爬取静态网页原理很好理解 就是通过cheerio 获取到页面body ，然后用类似于jquery的方式抓取数据。

  这个项目唯一的难点就是 对一个二级目录进行遍历， 得到三级目录， 二级目录和三级目录都保存的是url ，要做两个目录做循环，通过异步并发获取url 页面数据，保存到本地 