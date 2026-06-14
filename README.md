# 📈 พอร์ตลงทุน — Deploy Guide

## สิ่งที่ทำได้ใน App นี้
- ราคา Real-time จาก Yahoo Finance (อัปเดตทุก 5 นาที)
- บันทึกซื้อ/ขาย — คำนวณราคาทุนเฉลี่ย + Realized P&L อัตโนมัติ
- เงินที่ใส่ไปรวม ทั้งเป็น $ และ ฿
- กราฟมูลค่าพอร์ตเรา vs เงินที่ใส่ไป + ราคาหุ้นแต่ละตัว (1/3/6 เดือน)
- AI วิเคราะห์ — กดปุ่มเดียว ค้นข่าวและอธิบาย + แนะนำ DCA
- Export CSV ประวัติทั้งหมด
- ข้อมูลเก็บใน browser (ไม่หายเมื่อ refresh)

---

## Deploy บน Vercel (ฟรี — แนะนำ)

### 1. Push ขึ้น GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/my-portfolio.git
git push -u origin main
```

### 2. Deploy
- ไปที่ vercel.com → Sign up ด้วย GitHub
- กด "Add New Project" → เลือก repo
- Framework: Vite (auto-detect)
- กด Deploy

ได้ URL แบบ https://my-portfolio-xxx.vercel.app ทันที

### Update ในอนาคต
```bash
git add . && git commit -m "update" && git push
```
Vercel auto-deploy ทันที

---

## โครงสร้าง

```
src/
├── components/
│   ├── Dashboard.jsx       หน้าหลัก ภาพรวมพอร์ต
│   ├── Transactions.jsx    บันทึกซื้อ/ขาย + full log
│   ├── PriceChart.jsx      กราฟราคาหุ้นแต่ละตัว
│   ├── PortfolioChart.jsx  กราฟมูลค่าพอร์ตเรา
│   └── AiPanel.jsx         AI วิเคราะห์ด้วย Claude API
├── hooks/
│   ├── usePortfolio.js     State + localStorage
│   └── useStockPrices.js   Yahoo Finance API
└── App.css
```

---

## หุ้นไทย (SET)
ใส่ ticker เป็น AOT.BK, PTT.BK, CPALL.BK ฯลฯ
Yahoo Finance รองรับ suffix .BK สำหรับหุ้นไทย
