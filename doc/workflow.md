> 参考 https://github.com/microsoft/playwright-mcp

playwright 官方的 
  - browser_click	
	在网页上执行点击
  - browser_close	
	关闭页面
  - browser_console_messages	
	返回所有控制台消息
  - browser_drag	
	在两个元素之间执行拖放
  - browser_evaluate	
	评估页面或元素上的 JavaScript 表达式
  - browser_file_upload	
	上传一个或多个文件
  - browser_fill_form	
	填写多个表单字段
  - browser_handle_dialog	
	处理对话
  - browser_hover	
	将鼠标悬停在页面上的元素上
  - browser_install	
	安装配置中指定的浏览器。如果出现浏览器未安装的错误，请调用此方法。
  - browser_navigate	
	导航到 URL
  - browser_navigate_back	
	返回上一页
  - browser_network_requests	
	返回自加载页面以来的所有网络请求
  - browser_press_key	
	按下键盘上的一个键
  - browser_resize	
	调整浏览器窗口大小
  - browser_select_option	
	在下拉菜单中选择一个选项
  - browser_snapshot	
	捕获当前页面的可访问性快照，这比屏幕截图更好
  - browser_tabs	
	列出、创建、关闭或选择浏览器选项卡。
  - browser_take_screenshot	
	截取当前页面的屏幕截图。您无法根据屏幕截图执行任何操作，请使用 browser_snapshot 执行操作。
  - browser_type	
	在可编辑元素中输入文本
  - browser_wait_for	
	等待文本出现或消失或等待指定的时间过去