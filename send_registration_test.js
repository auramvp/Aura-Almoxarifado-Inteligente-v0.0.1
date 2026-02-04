import { Resend } from 'resend';

const RESEND_API_KEY = 're_i9pynwPX_AmFPbZMitLzprcnTPuCK6aPs';
const TO_EMAIL = 'carlosgabriel.camppos@gmail.com';

const resend = new Resend(RESEND_API_KEY);

const generateEmailTemplate = (title, content, accentColor = '#2563eb') => {
    const year = new Date().getFullYear();
    const logoUrl = "https://zdgapmcalocdvdgvbwsj.supabase.co/storage/v1/object/public/AuraLogo/branco.png";
    const emailId = Math.random().toString(36).substring(2, 10);

    return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f3f4f6; color: #1f2937;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${accentColor};">
            <tr>
                <td style="padding: 14px 24px; text-align: left;">
                     <span style="color: #ffffff; font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
                        ${title}
                     </span>
                </td>
            </tr>
        </table>
        <div style="background-color: #111827; padding: 32px 20px; text-align: center;">
             <img src="${logoUrl}" alt="Aura Almoxarife" width="160" style="display: block; margin: 0 auto; max-width: 160px; height: auto; border: 0; outline: none; text-decoration: none;" />
        </div>
        <div style="padding: 40px 32px;">
          ${content}
        </div>
        <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 12px; color: #9ca3af;">
            &copy; ${year} Aura Almoxarife Inteligente. Todos os direitos reservados.
          </p>
          <p style="margin: 8px 0 0; font-size: 12px; color: #9ca3af;">
            Este é um e-mail automático. Por favor, não responda.
          </p>
          <p style="margin: 8px 0 0; font-size: 10px; color: #e5e7eb;">
            ID: ${emailId}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const registrationLink = `https://app.auraalmoxarifado.com.br/?email=${encodeURIComponent(TO_EMAIL)}`;

const content = `
  <p style="margin-top: 0; font-size: 16px; line-height: 1.6; color: #374151;">
    Olá! Sua assinatura Aura foi confirmada. Agora falta pouco para você começar a otimizar seu almoxarifado.
  </p>

  <div style="text-align: center; margin: 32px 0;">
    <a href="${registrationLink}" style="background-color: #2563eb; color: #ffffff; padding: 16px 32px; border-radius: 12px; font-weight: 800; text-decoration: none; display: inline-block; text-transform: uppercase; font-size: 14px; letter-spacing: 1px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
      Finalizar Meu Cadastro
    </a>
  </div>

  <p style="font-size: 14px; color: #6b7280; line-height: 1.5;">
    Este link é exclusivo para o seu e-mail: <strong>${TO_EMAIL}</strong>. Ao clicar, seus dados de acesso já estarão pré-preenchidos para sua segurança.
  </p>
`;

const html = generateEmailTemplate('Convite de Cadastro', content, '#2563eb');

async function send() {
    console.log('Enviando convite de cadastro para:', TO_EMAIL);
    try {
        const data = await resend.emails.send({
            from: 'Aura Almoxarife <time@auraalmoxarifado.com.br>',
            to: TO_EMAIL,
            subject: '🚀 Comece a usar a Aura - Almoxarifado Inteligente (TESTE)',
            html: html
        });
        console.log('Email enviado com sucesso!', data);
    } catch (error) {
        console.error('Erro ao enviar email:', error);
    }
}

send();
