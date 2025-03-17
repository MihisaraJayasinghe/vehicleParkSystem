const express = require('express');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const FormData = require('form-data');

const app = express();
const upload = multer();

app.use(express.static(path.join(__dirname)));

// Proxy for image prediction
app.post('/predict_ocr', upload.single('file'), async (req, res) => {
  try {
    const form = new FormData();
    form.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });
    const response = await axios.post('http://127.0.0.1:8000/predict_ocr', form, {
      headers: form.getHeaders()
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).send(error.toString());
  }
});

// Proxy for video prediction
app.post('/predict_video', upload.single('file'), async (req, res) => {
  try {
    const form = new FormData();
    form.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });
    const response = await axios.post('http://127.0.0.1:8000/predict_video', form, {
      headers: form.getHeaders()
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).send(error.toString());
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Node server running on port ${PORT}`);
});
