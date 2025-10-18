// === IMPORT CƠ BẢN ===
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// === Axios Instance với Retry ===
const axiosInstance = axios.create({ timeout: 5000 });
axiosInstance.interceptors.response.use(
  res => res,
  async error => {
    const { config } = error;
    if (!config) return Promise.reject(error);

    const MAX_RETRIES = 3;
    config.__retryCount = config.__retryCount || 0;

    if (config.__retryCount < MAX_RETRIES) {
      config.__retryCount++;
      const delay = Math.pow(2, config.__retryCount) * 100;
      await new Promise(r => setTimeout(r, delay));
      return axiosInstance(config);
    }
    return Promise.reject(error);
  }
);

// === Bộ nhớ tạm cho random độ tin cậy ===
let lastPhien = null;
let lastConfidence = null;
function getStableConfidence(phien) {
  if (lastPhien !== phien) {
    lastPhien = phien;
    lastConfidence = (Math.random() * (80 - 40) + 40).toFixed(2) + "%"; // random 40-80%
  }
  return lastConfidence;
}

// === THUẬT TOÁN DỰ ĐOÁN T/X THEO XÍ NGẦU ===
function duDoanTheoXiNgau(dice) {
  if (!dice.length) return "Đợi thêm dữ liệu";

  const [d1, d2, d3] = dice;
  const total = d1 + d2 + d3;

  let result_list = [];
  for (let d of [d1, d2, d3]) {
    let tmp = d + total;
    if (tmp === 4 || tmp === 5) tmp -= 4;
    else if (tmp >= 6) tmp -= 6;
    result_list.push(tmp % 2 === 0 ? "Tài" : "Xỉu");
  }

  // lấy cái nào xuất hiện nhiều nhất
  return result_list.sort((a, b) =>
    result_list.filter(v => v === a).length - result_list.filter(v => v === b).length
  ).pop();
}

// === HÀM DỰ ĐOÁN VỊ (3 số cùng bên) ===
function getDuDoanVi(tong, duDoan) {
  let candidates = [];

  if (duDoan === "Xỉu") {
    // chỉ trong khoảng 4 - 10
    for (let i = tong - 1; i <= tong + 1; i++) {
      if (i >= 4 && i <= 10) candidates.push(i);
    }
    while (candidates.length < 3) {
      let r = Math.floor(Math.random() * 7) + 4; // random 4-10
      if (!candidates.includes(r)) candidates.push(r);
    }
  } else {
    // chỉ trong khoảng 11 - 17
    for (let i = tong - 1; i <= tong + 1; i++) {
      if (i >= 11 && i <= 17) candidates.push(i);
    }
    while (candidates.length < 3) {
      let r = Math.floor(Math.random() * 7) + 11; // random 11-17
      if (!candidates.includes(r)) candidates.push(r);
    }
  }

  return candidates.slice(0, 3);
}

// === API CHÍNH ===
app.get('/api/sicbo/vip', async (req, res, next) => {
  try {
    const response = await axiosInstance.get('https://ksj-59sp.onrender.com/api/sicbo/live');
    const latest = response.data;

    if (!latest || !latest.Phien) {
      return res.json({ error: "Không đủ dữ liệu lịch sử." });
    }

    const dice = [latest.Xuc_xac_1, latest.Xuc_xac_2, latest.Xuc_xac_3];

    // dự đoán
    const prediction = duDoanTheoXiNgau(dice);

    // random độ tin cậy
    const doTinCay = getStableConfidence(latest.Phien);

    // dự đoán vị (3 số cùng bên Tài/Xỉu)
    const duDoanVi = getDuDoanVi(latest.Tong, prediction);

    // chỉ 1 form JSON duy nhất
    const result = {
      id: "@",
      phien_truoc: `#${latest.Phien}`,
      ket_qua: latest.Ket_qua,
      xuc_xac: dice,
      tong: latest.Tong,
      phien_sau: parseInt(latest.Phien) + 1,
      du_doan: prediction,
      do_tin_cay: doTinCay,
      du_doan_vi: duDoanVi,
      giai_thich: "địt mẹ tuấn kiệt"
    };

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// === Middleware lỗi ===
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server lỗi." });
});

app.listen(PORT, () => {
  console.log(`✅ API Sicbo VIP chạy tại http://localhost:${PORT}`);
});

      
