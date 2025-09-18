## 🔌 API 端点

### 1. OCR 识别

🔗 **端点**：`POST /ocr`

| 参数 | 类型 | 描述 |
|------|------|------|
| `file` | File | 图片文件（可选） |
| `image` | String | Base64 编码的图片字符串（可选） |
| `probability` | Boolean | 是否返回概率（默认：false） |
| `charsets` | String | 字符集（可选） |
| `png_fix` | Boolean | 是否进行 PNG 修复（默认：false） |

### 2. 滑动验证码匹配

🔗 **端点**：`POST /slide_match`

| 参数                                                                                        | 类型                                                                                         | 描述                                                                                         |
|-------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------|
| `target_file`                                                                             | File                                                                                       | 目标图片文件（可选）需要与target字段同时使用                                                                  |
| `target`                                                                                  | String                                                                                     | Base64 编码的目标图片字符串（可选） 需要与target_file字段同时使用                                                 |
| `background_file`                                                                         | File                                                                                       | 背景图片文件（可选）    需要与background字段同时使用                                                          |
| `background`                                                                              | String                                                                                     | Base64 编码的背景图片字符串（可选）  需要与background_file字段同时使用                                            |
| `simple_target`                                                                           | Boolean                                                                                    | 是否使用简单目标（默认：false）                                                                         |
|| |  `target_file`和`target` 为一组字段，`background_file`和`background` 为一组字段， 两组字段不可同时使用，同时使用则仅一组会生效 |


### 3. 目标检测

🔗 **端点**：`POST /detection`

| 参数 | 类型 | 描述 |
|------|------|------|
| `file` | File | 图片文件（可选） |
| `image` | String | Base64 编码的图片字符串（可选） |

## 📘 API 调用示例

<details>
<summary>Curl</sumary>

请求：
```
curl --location 'http://ip:port/ocr' \
--form 'image="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"'
```

响应：
```
  {
    "code": 200,
    "message": "Success",
    "data": "88su"
  }
```

<summary>Python</summary>

```python
import requests
import base64

url = "http://localhost:8000/ocr"
image_path = "path/to/your/image.jpg"

with open(image_path, "rb") as image_file:
    encoded_string = base64.b64encode(image_file.read()).decode('utf-8')

data = {
    "image": encoded_string,
    "probability": False,
    "png_fix": False
}

response = requests.post(url, data=data)
print(response.json())
```
</details>
<details>
<summary>Node.js</summary>

```javascript
const axios = require('axios');
const fs = require('fs');

const url = 'http://localhost:8000/ocr';
const imagePath = 'path/to/your/image.jpg';

const imageBuffer = fs.readFileSync(imagePath);
const base64Image = imageBuffer.toString('base64');

const data = {
  image: base64Image,
  probability: false,
  png_fix: false
};

axios.post(url, data)
  .then(response => {
    console.log(response.data);
  })
  .catch(error => {
    console.error('Error:', error);
  });
```
</details>

<details>
<summary>C#</summary>

```csharp
using System;
using System.Net.Http;
using System.IO;
using System.Threading.Tasks;

class Program
{
    static async Task Main(string[] args)
    {
        var url = "http://localhost:8000/ocr";
        var imagePath = "path/to/your/image.jpg";

        var imageBytes = File.ReadAllBytes(imagePath);
        var base64Image = Convert.ToBase64String(imageBytes);

        var client = new HttpClient();
        var content = new MultipartFormDataContent();
        content.Add(new StringContent(base64Image), "image");
        content.Add(new StringContent("false"), "probability");
        content.Add(new StringContent("false"), "png_fix");

        var response = await client.PostAsync(url, content);
        var result = await response.Content.ReadAsStringAsync();
        Console.WriteLine(result);
    }
}
```
</details>

<details>
<summary>PHP</summary>

```php
<?php

$url = 'http://localhost:8000/ocr';
$imagePath = 'path/to/your/image.jpg';

$imageData = base64_encode(file_get_contents($imagePath));

$data = array(
    'image' => $imageData,
    'probability' => 'false',
    'png_fix' => 'false'
);

$options = array(
    'http' => array(
        'header'  => "Content-type: application/x-www-form-urlencoded\r\n",
        'method'  => 'POST',
        'content' => http_build_query($data)
    )
);

$context  = stream_context_create($options);
$result = file_get_contents($url, false, $context);

echo $result;
?>
```
</details>

<details>
<summary>Go</summary>

```go
package main

import (
    "bytes"
    "encoding/base64"
    "encoding/json"
    "fmt"
    "io/ioutil"
    "net/http"
    "net/url"
)

func main() {
    apiURL := "http://localhost:8000/ocr"
    imagePath := "path/to/your/image.jpg"

    imageData, err := ioutil.ReadFile(imagePath)
    if err != nil {
        panic(err)
    }

    base64Image := base64.StdEncoding.EncodeToString(imageData)

    data := url.Values{}
    data.Set("image", base64Image)
    data.Set("probability", "false")
    data.Set("png_fix", "false")

    resp, err := http.PostForm(apiURL, data)
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()

    body, err := ioutil.ReadAll(resp.Body)
    if err != nil {
        panic(err)
    }

    fmt.Println(string(body))
}
```
</details>

<details>
<summary>易语言</summary>

```易语言
.版本 2

.程序集 调用OCR接口

.子程序 主函数, 整数型
.局部变量 请求头, QQ.HttpHeaders
.局部变量 请求内容, QQ.HttpMultiData
.局部变量 图片路径, 文本型
.局部变量 图片数据, 字节集
.局部变量 HTTP, QQ.Http

图片路径 ＝ "path/to/your/image.jpg"
图片数据 ＝ 读入文件 (图片路径)

请求头.添加 ("Content-Type", "application/x-www-form-urlencoded")

请求内容.添加文本 ("image", 到Base64 (图片数据))
请求内容.添加文本 ("probability", "false")
请求内容.添加文本 ("png_fix", "false")

HTTP.发送POST请求 ("http://localhost:8000/ocr", 请求内容, 请求头)

调试输出 (HTTP.获取返回文本())

返回 (0)
```
</details>

> **注意**：使用示例前，请确保安装了必要的依赖库，并根据实际环境修改服务器地址和图片路径。