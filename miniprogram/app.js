// app.js
App({
  onLaunch: function () {
    this.globalData = {
      // env 参数说明：
      // env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会请求到哪个云环境的资源
      // 此处请填入环境 ID, 环境 ID 可在微信开发者工具右上顶部工具栏点击云开发按钮打开获取
      // 注意：2026-08 最终迁移——数学小伴专属环境 math-agent-d5g60mlm8bb6878ee（微信开发者工具创建，绑定 wx608070b3eb1b9cfd）
      // 旧环境：d2g(cloud1-d2gw6oc8z0009b8a2)已销毁；d9(cloud2-d9g3j3yj3a8e3149a)不可用已撤出
      env: "math-agent-d5g60mlm8bb6878ee",
    };
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
    }
  },
});
