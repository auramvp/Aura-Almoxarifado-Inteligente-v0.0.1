const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();
app.use(cors());
app.use(express.json());

const RESEND_API_KEY = 're_i9pynwPX_AmFPbZMitLzprcnTPuCK6aPs';
const resend = new Resend(RESEND_API_KEY);

app.post('/send-email', async (req, res) => {
  try {
    const { to, subject, html, from } = req.body;
    console.log(`[Proxy] Recebido pedido de envio para: ${to}`);

    const { data, error } = await resend.emails.send({
      from: from || 'Aura Almoxarife <time@auraalmoxarifado.com.br>',
      to,
      subject,
      html
    });

    if (error) {
        console.error('[Proxy] Erro Resend:', error);
        return res.status(400).json({ error });
    }

    console.log('[Proxy] Email enviado com sucesso:', data);
    res.status(200).json(data);
  } catch (error) {
    console.error('[Proxy] Erro interno:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor Proxy de E-mail rodando em http://localhost:${PORT}`);
  console.log(`👉 Backend local pronto para contornar problemas de CORS.`);
});
