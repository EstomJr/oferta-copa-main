// Cole este código no Google Apps Script (script.google.com)
// Deploy como Web App: Executar como "Eu" / Acesso "Qualquer pessoa"

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    var email = data.email;
    var nome = data.nome;
    var pdfUrl = data.pdfUrl;
    var subject = data.subject || "Sua Figurinha da Copa 2026 está pronta! ⚽";

    if (!email || !pdfUrl) {
      return ContentService.createTextOutput(JSON.stringify({ error: "email e pdfUrl obrigatórios" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Baixar o PDF
    var pdfBlob = UrlFetchApp.fetch(pdfUrl).getBlob();
    pdfBlob.setName("figurinha-copa-2026-" + nome.toLowerCase().replace(/\s+/g, "-") + ".pdf");

    // Montar HTML do email
    var html = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">' +
      '<h1 style="color: #1E3A8A; text-align: center;">GOOLL! ⚽</h1>' +
      '<p style="font-size: 18px; text-align: center;">Olá <strong>' + nome + '</strong>!</p>' +
      '<p style="font-size: 16px; text-align: center;">Sua figurinha personalizada da Copa do Mundo 2026 está pronta!</p>' +
      '<p style="font-size: 16px; text-align: center;">O arquivo PDF em anexo contém sua figurinha no tamanho padrão, pronta para impressão.</p>' +
      '<p style="font-size: 14px; color: #666; text-align: center;">Dica: imprima em papel fotográfico para melhor qualidade!</p>' +
      '<hr style="border: 1px solid #FFD700; margin: 20px 0;" />' +
      '<p style="font-size: 12px; color: #999; text-align: center;">Figurinha Copa 2026 — Arquivo digital para impressão.</p>' +
      '</div>';

    // Enviar email
    GmailApp.sendEmail(email, subject, "", {
      htmlBody: html,
      attachments: [pdfBlob],
      name: "Figurinha Copa 2026"
    });

    return ContentService.createTextOutput(JSON.stringify({ ok: true, message: "Email enviado via Gmail" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Teste rápido (rode manualmente no editor)
function testDoPost() {
  var e = {
    postData: {
      contents: JSON.stringify({
        email: "heros.27.ar@gmail.com",
        nome: "Teste",
        pdfUrl: "https://aqtghj3ft8iryz4r.public.blob.vercel-storage.com/pdfs/72d5245e-1148-4b43-bc75-94395f579972.pdf"
      })
    }
  };
  var result = doPost(e);
  Logger.log(result.getContent());
}
