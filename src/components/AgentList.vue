<template>
  <div class="agent-list-root">
    <div class="table-section">
      <table class="agent-table">
        <thead>
          <tr>
            <th>智能体名称</th>
            <th>运行状态</th>
            <th>创建时间</th>
            <th>执行任务数</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>智能体A</td>
            <td><span class="status running">运行中</span></td>
            <td>2025-09-01 10:00</td>
            <td>12</td>
            <td><button class="btn">详情</button></td>
          </tr>
          <tr>
            <td>智能体B</td>
            <td><span class="status stopped">已停止</span></td>
            <td>2025-08-28 14:22</td>
            <td>7</td>
            <td><button class="btn">详情</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>


<style scoped>
/* 以白色为主，焦点色为蓝色 */
.agent-list-root {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(36, 37, 38, 0.04);
  padding: 16px;
  margin-top: 16px;
}
.header-bar {
  margin-bottom: 18px;
}
.create-btn {
  background: #1976d2;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 8px 22px;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.08);
}
.create-btn:hover {
  background: #1565c0;
}
.agent-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.agent-table th, .agent-table td {
  padding: 12px 8px;
  text-align: left;
}
.agent-table thead {
  background: #e3f0fd;
}
.agent-table tbody tr {
  border-bottom: 1px solid #e0e3eb;
}
.status.running {
  color: #1976d2;
  font-weight: bold;
}
.status.stopped {
  color: #f44336;
  font-weight: bold;
}
.btn {
  background: #1976d2;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 18px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}
.btn:hover {
  background: #1565c0;
}
</style>
