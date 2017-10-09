/**
 * 提供房天下 dom 查找 公共方法
 */
/**
 * 在售新楼盘 的查询方法
 */
let Utils = function () {

    //统一判断传入值是否为string
    let strType = function (str) {
        if (!str) {
            console.log('传入数据为' + str + ' 不能进行正则匹配！')
            return false
        }
        return true
    }
    //当前页数起点位置 -b91为第一页
    let startPagePosition = function (No) {
        return '-b9' + No
    }
    return {
        //去掉（488） 总页数外面() 返回数字条数 488 详细参见 exec()方法
        getTotalCount: function (str) {
            if (!strType(str)) {
                return
            }
            let reg = /\d+/;
            return parseInt(reg.exec(str)[0])
        },
        getTotalPage: function (str) {
            if (!strType(str)) {
                return
            }
            // 输入 '2/23 44'  输出 /23 23
            let reg = /\/(\d+)/;
            return parseInt(reg.exec(str)[1])
        },
        getZone: function (str) {
            if (!strType(str)) {
                return
            }
            let reg = /^\[(.+)].*/;
            return reg.exec(str)[1]
        },
        //var reg = /(\d+)(.+)\/.*/; ttt = reg.exec(str); ["7800元/㎡", "7800", "元", index: 0, input: "7800元/㎡"]
        getPrice: function (str) {
            let reg = /(\d+)(.+)\/.*/;
            let result = reg.exec(str);
            let obj = {
                detail: !result ? '' : result[0],
                price: !result ? 0 : parseInt(result[1]),
                unit: !result ? '' : result[2]
            }
            return obj
        },
        //根据总页数 生成每页的url 数组
        getPageArr: function (totalCount) {
            let pageUrlArr = []
            for (let i = 1; i <= totalCount; i++) {
                let convertPage = i < 10 ? '0' + i : i;
                pageUrlArr.push(baseUrl + convertPage + '/');
            }
            return pageUrlArr

        }

    }
}
//dom计算函数
let DomCount = function () {
    return {
        starCount: function (el, $) {
            let orangeStar = $(el).find('.nlc_details .house_value  .star_group li').filter('.orange-star').length;
            let halfStar = $(el).find('.nlc_details .house_value  .star_group li').filter('.half-star').length;
            return orangeStar * 1 + halfStar * 0.5
        },
        //获取楼盘类型， 改善型 ，刚需...
        getType: function (el, $) {
            let listString = $(el).find('.nlc_details .fangyuan a').text();
            let arr = listString.split(' ');
            return arr
        }
    }
}
exports.Utils = Utils;
exports.DomCount = DomCount;