const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function getProfile() {
  try {
    const res = await db.collection('mt_profile').where({ isDeleted: _.neq(true) }).limit(1).get();
    
    if (res.data.length > 0) {
      return { code: 0, data: res.data[0] };
    }

    const defaultProfile = {
      isDeleted: false,
      nickName: '数学小能手',
      totalExp: 0,
      streak: 0,
      lastStudyDate: null,
      totalStudyDays: 0,
      totalMessages: 0,
      masteredTopics: [],
      learningTopics: [],
      weakPoints: [],
      studyGoals: [],
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),
    };

    const addRes = await db.collection('mt_profile').add({ data: defaultProfile });
    defaultProfile._id = addRes._id;
    
    return { code: 0, data: defaultProfile };
  } catch (e) {
    console.error('[math-agent] getProfile error:', e);
    return { code: 500, error: '获取档案失败' };
  }
}

async function updateProfile(data) {
  if (!data) {
    return { code: 400, error: '参数不能为空' };
  }

  try {
    const res = await db.collection('mt_profile').where({ isDeleted: _.neq(true) }).limit(1).get();
    
    if (res.data.length === 0) {
      return { code: 404, error: '档案不存在' };
    }

    await db.collection('mt_profile').doc(res.data[0]._id).update({
      data: { ...data, updatedAt: db.serverDate() },
    });
    
    return { code: 0, message: '更新成功' };
  } catch (e) {
    console.error('[math-agent] updateProfile error:', e);
    return { code: 500, error: '更新失败' };
  }
}

async function addExp(amount) {
  try {
    const res = await db.collection('mt_profile').where({ isDeleted: _.neq(true) }).limit(1).get();
    
    if (res.data.length === 0) {
      await getProfile();
      return addExp(amount);
    }

    await db.collection('mt_profile').doc(res.data[0]._id).update({
      data: {
        totalExp: _.inc(amount),
        updatedAt: db.serverDate(),
      },
    });

    return { code: 0 };
  } catch (e) {
    console.error('[math-agent] addExp error:', e);
    return { code: 500, error: '添加经验失败' };
  }
}

module.exports = { getProfile, updateProfile, addExp };
