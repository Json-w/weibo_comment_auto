import request from 'request'
import { Cookie } from 'request-cookies'
import fs from 'fs'
import cheerio from 'cheerio'

let userUrl = '';
const options = {
  url: 'https://passport.weibo.cn/sso/login',
  method: 'POST',
  headers: {
    'Accept': '*/*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.8,zh-CN;q=0.6,zh;q=0.4',
    'Connection': 'keep-alive',
    'Content-Length': '186',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Cookie': '_T_WM=ade0c608806801e188560af63f6e5db7',
    'Host': 'passport.weibo.cn',
    'Origin': 'https://passport.weibo.cn',
    'Referer': 'https://passport.weibo.cn/signin/login?entry=mweibo&r=http%3A%2F%2Fweibo.cn%2F&backTitle=%CE%A2%B2%A9&vt=',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.81 Safari/537.36'
  },
  form: {
    'username': process.argv[2],
    'password': process.argv[3],
    'savestate': '1',
    'r': 'http://weibo.cn/',
    'ec': '0',
    'pagerefer': 'http://weibo.cn/pub/',
    'entry': 'mweibo',
    'wentry': '',
    'loginfrom': '',
    'client_id': '',
    'code': '',
    'qq': '',
    'mainpageflag': '1',
    'hff': '',
    'hfp': '',
  }
}

let commented = [];
const login = ()=> {
  request(options, (error, response)=> {
    console.log(`response code:${response.statusCode}`);
    fs.open('myfile', 'wx', (err, fd)=> {
      if (err) {
        if (err.code === 'EEXIST') {
          console.error('myfile already exists');
          return;
        }
        throw err;
      }
      let headerCookies = response.headers['set-cookie'];
      let cookies = [];
      for (let i in headerCookies) {
        var cookie = new Cookie(headerCookies[i]);
        cookies.push(cookie);
      }
      fs.writeSync(fd, JSON.stringify(cookies), 'UTF-8')
    })
  })
}


const search = (name, callback)=> {
  const options = {
    url: 'http://weibo.cn/5577656591/searchuser',
    method: 'POST',
    gzip: true,
    headers: {
      'Accept': '*/*',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.8,zh-CN;q=0.6,zh;q=0.4',
      'Connection': 'keep-alive',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': getCookies(),
      'Host': 'weibo.cn',
      'Origin': 'http://weibo.cn',
      'Referer': 'http://weibo.cn/5577656591/follow',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.81 Safari/537.36'
    },
    form: {
      keyword: name,
      type: 0,
      range: 2,
    }
  }
  request(options, (error, response, body)=> {
    console.log(`search status:${response.statusCode}`)
    if (callback === 'undefined') {
      return;
    }
    callback(body, visitAndCommentLatestPost);
  })

}

const getCookies = ()=> {
  var BUFFER_SIZE = 1000;
  let buffer = Buffer.alloc(BUFFER_SIZE);
  let fd = fs.openSync('myfile', 'r',);
  let bytesRead = fs.readSync(fd, buffer, 0, BUFFER_SIZE);
  let cookieArray = JSON.parse(buffer.slice(0, bytesRead).toString());
  let cookies = '';
  for (let i in cookieArray) {
    cookies += cookieArray[i].key + '=' + cookieArray[i].value + ';'
  }
  return cookies.substring(0, cookies.lastIndexOf(';'))
}

const formateSearchResult = (body, callback)=> {
  const $ = cheerio.load(body);
  userUrl = $('table a')[0].attribs.href;
  console.log(userUrl);
  callback(userUrl);
}

const visitAndCommentLatestPost = (userUrl)=> {
  let options = createGetOptions(userUrl)

  request(options, (error, response, body)=> {
    console.log(`user url status code: ${response.statusCode}`)
    const $ = cheerio.load(body);
    $('div').each((i, el)=> {
      if ($(el).attr('id') != undefined) {
        let postId = $(el).attr('id');
        console.log('id:' + postId);
        $(el).children().each((i, el)=> {
          if ($(el).text().includes('评论')) {
            let postTime = $(el).children().last().text();
            console.log(postTime)
            // var postTimeArr = /(\d+)月(\d+)日 (\d+):(\d+)/g.exec(postTime);
            // var postDatetime = new Date(2017, postTimeArr[1], postTimeArr[2], postTimeArr[3], postTimeArr[4]);
            // fs.open('latestTime', 'wx', (err, fd)=> {
            //   if (err) {
            //     if (err.code === 'EEXIST') {
            //       console.error('latestTIme already exists');
            //       return;
            //     }
            //     throw err;
            //   }
            //   fs.writeSync(fd, postDatetime, 'UTF-8')
            // })
            if (postTime.includes('分钟前') && !commented.includes(postId)) {
              const commentUrl = $(el).children().last().prev().prev().attr('href');
              request(createGetOptions(commentUrl), (error, response, body)=> {
                const $ = cheerio.load(body);
                let $form = $('form');
                const postUrl = 'http://weibo.cn' + $form.attr('action');
                let postData = {};
                $form.serializeArray().map((el, i)=> {
                  postData[el.name] = el.value;
                });
                postData.content = "I'm pei's weibo robot, I'm here to say hello once you post weibo";
                console.log(postData);
                console.log(postUrl);
                request(createPostOptions(postUrl, postData, commentUrl), (error, response, body)=> {
                  console.log(`statusCode:${response.statusCode}`)
                  commented.push(postId)
                })
              })
            }
            return false;
          }
        })
        return false;
      }
    });
  })
}


const createGetOptions = (url)=> {
  return {
    url: url,
    method: 'get',
    gzip: true,
    headers: {
      'Accept': '*/*',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.8,zh-CN;q=0.6,zh;q=0.4',
      'Connection': 'keep-alive',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': getCookies(),
      'Host': 'weibo.cn',
      'Origin': 'http://weibo.cn',
      'Referer': 'http://weibo.cn/5577656591/follow',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.81 Safari/537.36'
    },
  }
}


const createPostOptions = (url, data, referUrl)=> {
  return {
    url: url,
    method: 'POST',
    headers: {
      'Accept': '*/*',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.8,zh-CN;q=0.6,zh;q=0.4',
      'Connection': 'keep-alive',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': getCookies(),
      'Host': 'weibo.cn',
      'Origin': 'http://weibo.cn',
      'Referer': referUrl,
      'Upgrade-Insecure-Requests': 1,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.81 Safari/537.36'
    },
    form: data
  }
}

login();
setInterval(()=> {
  search(process.argv[4], formateSearchResult);
}, 2 * 1000);
