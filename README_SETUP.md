/**
 * RDS Quote Pro v5.2 — callback fix for local HTML approval-link publishing
 *
 * Deploy as a Web app:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * After installing, run authorizeServices() once and approve Gmail/Drive.
 */

const SELLER_EMAIL = 'sworthington@rdspos.com';
const ARCHIVE_ROOT_FOLDER = 'RDS Quote Pro Signed Proposals';
const APPROVAL_ROOT_FOLDER = 'RDS Quote Pro Customer Approval Pages';
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_APPROVAL_HTML_CHARS = 1500000;

function doGet(e) {
  const token = e && e.parameter ? String(e.parameter.quote || '').trim() : '';
  if (!token) return serviceStatusPage_();
  if (!/^[A-Za-z0-9_-]{24,120}$/.test(token)) return messagePage_('Invalid proposal link', 'This proposal link is not valid.');
  try {
    const folder = getOrCreateFolder_(DriveApp.getRootFolder(), APPROVAL_ROOT_FOLDER);
    const files = folder.getFilesByName(token + '.html');
    if (!files.hasNext()) return messagePage_('Proposal not found', 'This proposal link may have expired or been removed.');
    const page = files.next().getBlob().getDataAsString('UTF-8');
    return HtmlService.createHtmlOutput(page)
      .setTitle('RDS Customer Proposal')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    console.error(err);
    return messagePage_('Unable to open proposal', 'The proposal could not be loaded. Please contact Scott Worthington at RDS.');
  }
}

function doPost(e) {
  let requestId = '';
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    if (!e || !e.parameter || !e.parameter.payload) throw new Error('No proposal payload was received.');
    const data = JSON.parse(e.parameter.payload);
    requestId = String(data.requestId || '').trim();
    if (String(data.action || '') === 'createApprovalLink') return createApprovalLink_(data);
    return processSignedProposal_(data);
  } catch (error) {
    console.error(error);
    return callbackPage_({source:'rds-quote-mailer',requestId,ok:false,error:error && error.message ? error.message : String(error)});
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function createApprovalLink_(data) {
  const requestId = String(data.requestId || '').trim();
  try {
    const submittedSellerEmail = String(data.sellerEmail || '').trim();
    if (submittedSellerEmail.toLowerCase() !== SELLER_EMAIL.toLowerCase()) throw new Error('The seller email address is not authorized.');
    const pageHtml = String(data.html || '');
    if (!pageHtml || pageHtml.length < 1000) throw new Error('The customer approval page was missing or incomplete.');
    if (pageHtml.length > MAX_APPROVAL_HTML_CHARS) throw new Error('The customer approval page is too large to publish.');
    const token = Utilities.getUuid().replace(/-/g,'') + Utilities.getUuid().replace(/-/g,'').slice(0,16);
    const folder = getOrCreateFolder_(DriveApp.getRootFolder(), APPROVAL_ROOT_FOLDER);
    const file = folder.createFile(token + '.html', pageHtml, MimeType.HTML);
    file.setDescription(JSON.stringify({customerName:String(data.customerName||''),customerEmail:String(data.customerEmail||''),quoteNumber:String(data.quoteNumber||''),project:String(data.project||''),createdAt:new Date().toISOString()}));
    const baseUrl = ScriptApp.getService().getUrl();
    if (!baseUrl) throw new Error('The Apps Script project is not deployed as a Web app.');
    const approvalUrl = baseUrl+'?quote='+encodeURIComponent(token);
    let emailed = false;
    if (data.emailCustomer === true || String(data.emailCustomer || '').toLowerCase() === 'true') {
      const customerEmail = String(data.customerEmail || '').trim();
      if (!customerEmail || !isEmail_(customerEmail)) throw new Error('A valid customer email address is required to email the approval link.');
      emailApprovalLink_(data, approvalUrl);
      emailed = true;
    }
    return callbackPage_({source:'rds-quote-linker',requestId,ok:true,approvalUrl,emailed});
  } catch (error) {
    return callbackPage_({source:'rds-quote-linker',requestId,ok:false,error:error && error.message ? error.message : String(error)});
  }
}

function emailApprovalLink_(data, approvalUrl) {
  const customerEmail = String(data.customerEmail || '').trim();
  const customerName = String(data.customerName || 'Customer').trim();
  const quoteNumber = String(data.quoteNumber || '').trim();
  const project = String(data.project || '').trim();
  const salespersonName = String(data.salespersonName || 'Scott Worthington').trim();
  const salespersonPhone = String(data.salespersonPhone || '952-239-2949').trim();
  const subject = 'RDS Proposal for Review' + (quoteNumber ? ' - ' + quoteNumber : '');
  const htmlBody = [
    '<div style="font-family:Arial,sans-serif;line-height:1.5;color:#222;max-width:640px">',
    '<p>Hello' + (customerName ? ' ' + escapeHtml_(customerName) : '') + ',</p>',
    '<p>Please review and approve your RDS proposal' + (quoteNumber ? ' <strong>' + escapeHtml_(quoteNumber) + '</strong>' : '') + '.</p>',
    project ? '<p><strong>Project:</strong> ' + escapeHtml_(project) + '</p>' : '',
    '<p style="margin:28px 0"><a href="' + escapeHtml_(approvalUrl) + '" style="background:#b32025;color:#fff;text-decoration:none;padding:14px 22px;border-radius:6px;font-weight:bold;display:inline-block">Review and Approve Proposal</a></p>',
    '<p>This link works on iPhone, iPad, Android, Mac, and Windows devices.</p>',
    '<p>If the button does not open, copy and paste this link into your browser:<br><a href="' + escapeHtml_(approvalUrl) + '">' + escapeHtml_(approvalUrl) + '</a></p>',
    '<p>Thank you,<br>' + escapeHtml_(salespersonName) + '<br>' + escapeHtml_(salespersonPhone) + '<br><a href="mailto:' + escapeHtml_(SELLER_EMAIL) + '">' + escapeHtml_(SELLER_EMAIL) + '</a></p>',
    '</div>'
  ].join('');
  const body = [
    'Hello' + (customerName ? ' ' + customerName : '') + ',',
    '',
    'Please review and approve your RDS proposal' + (quoteNumber ? ' ' + quoteNumber : '') + '.',
    project ? 'Project: ' + project : '',
    '',
    approvalUrl,
    '',
    'This link works on iPhone, iPad, Android, Mac, and Windows devices.',
    '',
    'Thank you,',
    salespersonName,
    salespersonPhone,
    SELLER_EMAIL
  ].filter(function(v){ return v !== ''; }).join('\n');
  MailApp.sendEmail({
    to: customerEmail,
    cc: SELLER_EMAIL,
    replyTo: SELLER_EMAIL,
    subject: subject,
    body: body,
    htmlBody: htmlBody,
    name: 'RDS Quote Pro'
  });
}

function processSignedProposal_(data) {
  const requestId = String(data.requestId || '').trim();
  const customerEmail = String(data.customerEmail || '').trim();
  const submittedSellerEmail = String(data.sellerEmail || '').trim();
  if (!customerEmail || !isEmail_(customerEmail)) throw new Error('The customer email address is missing or invalid.');
  if (submittedSellerEmail.toLowerCase() !== SELLER_EMAIL.toLowerCase()) throw new Error('The seller email address is not authorized.');
  const cache = CacheService.getScriptCache();
  if (requestId && cache.get(requestId)) return callbackPage_({source:'rds-quote-mailer',requestId,ok:true,duplicate:true});
  if (requestId) cache.put(requestId,'processing',600);
  try {
    const pdfBase64 = String(data.pdfBase64 || '').trim().replace(/^data:application\/pdf;base64,/i,'');
    if (!pdfBase64) throw new Error('No signed PDF data was received.');
    const pdfBytes = Utilities.base64Decode(pdfBase64);
    if (!pdfBytes || pdfBytes.length === 0) throw new Error('The signed PDF was empty.');
    if (pdfBytes.length > MAX_PDF_BYTES) throw new Error('The signed PDF is too large to email.');
    const filename = safeFileName_(data.filename || 'RDS_Proposal_Signed.pdf');
    const pdf = Utilities.newBlob(pdfBytes,'application/pdf',filename);
    const customerName = String(data.customerName || 'Customer').trim();
    const quoteNumber = String(data.quoteNumber || '').trim();
    const project = String(data.project || '').trim();
    const signerName = String(data.signerName || '').trim();
    const acceptedAt = String(data.acceptedAt || '').trim();
    const subject = 'Signed RDS Proposal'+(quoteNumber?' - '+quoteNumber:'')+(customerName?' - '+customerName:'');
    const body = ['Hello,','','Attached is the completed and electronically signed RDS proposal'+(quoteNumber?' '+quoteNumber:'')+'.',project?'Project: '+project:'',signerName?'Accepted by: '+signerName:'',acceptedAt?'Accepted: '+acceptedAt:'','','A copy has also been sent to Scott Worthington at RDS.','','Thank you.'].filter(v=>v!==null).join('\n');
    MailApp.sendEmail({to:customerEmail,cc:SELLER_EMAIL,replyTo:SELLER_EMAIL,subject,body,attachments:[pdf],name:'RDS Quote Pro'});
    let archived=false, archivePath='', fileUrl='', archiveWarning='';
    try { const a=archivePdf_(pdf,customerName,quoteNumber,acceptedAt); archived=true;archivePath=a.path;fileUrl=a.url; }
    catch(err){archiveWarning=err&&err.message?err.message:String(err);console.error('Drive archive failed: '+archiveWarning);}
    if(requestId) cache.put(requestId,'complete',21600);
    return callbackPage_({source:'rds-quote-mailer',requestId,ok:true,emailed:true,archived,archivePath,fileUrl,archiveWarning});
  } catch(err) {
    if(requestId) try{cache.remove(requestId)}catch(ignore){}
    throw err;
  }
}

function archivePdf_(pdfBlob, customerName, quoteNumber, acceptedAt) {
  const root=getOrCreateFolder_(DriveApp.getRootFolder(),ARCHIVE_ROOT_FOLDER);
  const yearFolder=getOrCreateFolder_(root,getArchiveYear_(acceptedAt));
  const customerFolder=getOrCreateFolder_(yearFolder,safeFolderName_(customerName||'Customer'));
  let filename=pdfBlob.getName();
  if(customerFolder.getFilesByName(filename).hasNext()){
    const stamp=Utilities.formatDate(new Date(),Session.getScriptTimeZone()||'America/Chicago','yyyyMMdd_HHmmss');
    filename=filename.replace(/\.pdf$/i,'')+'_'+stamp+'.pdf';
  }
  const file=customerFolder.createFile(pdfBlob.copyBlob().setName(filename));
  file.setDescription('Electronically signed RDS proposal'+(quoteNumber?' '+quoteNumber:'')+'.');
  return {path:ARCHIVE_ROOT_FOLDER+'/'+yearFolder.getName()+'/'+customerFolder.getName()+'/'+filename,url:file.getUrl()};
}

function getOrCreateFolder_(parent,name){const it=parent.getFoldersByName(name);return it.hasNext()?it.next():parent.createFolder(name)}
function getArchiveYear_(acceptedAt){const d=acceptedAt?new Date(acceptedAt):new Date();return isNaN(d.getTime())?String(new Date().getFullYear()):String(d.getFullYear())}
function safeFolderName_(v){return String(v||'Customer').replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim().slice(0,100)||'Customer'}
function safeFileName_(v){let n=String(v||'RDS_Proposal_Signed.pdf').replace(/[\\/:*?"<>|]+/g,'_').trim();if(!/\.pdf$/i.test(n))n+='.pdf';return n.slice(0,180)}
function isEmail_(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||''))}

function callbackPage_(payload){
  const json=JSON.stringify(payload).replace(/</g,'\\u003c');
  const page = '<!doctype html><html><head><meta charset="utf-8"></head><body>' +
    '<script>(function(){' +
    'var message=' + json + ';' +
    'try{window.parent.postMessage(message,"*");}catch(e){}' +
    'try{window.top.postMessage(message,"*");}catch(e){}' +
    'try{if(window.parent&&window.parent.parent){window.parent.parent.postMessage(message,"*");}}catch(e){}' +
    '})();<\/script></body></html>';
  return HtmlService.createHtmlOutput(page)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function serviceStatusPage_(){return HtmlService.createHtmlOutput('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>RDS Quote Pro v5</title></head><body style="font-family:Arial,sans-serif;padding:28px;max-width:720px;margin:auto"><h2>RDS Quote Pro v5 is active</h2><p>This service creates customer approval links, emails signed proposals, and archives completed PDFs in Google Drive.</p></body></html>')}
function messagePage_(title,message){return HtmlService.createHtmlOutput('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escapeHtml_(title)+'</title></head><body style="font-family:Arial,sans-serif;padding:28px;max-width:720px;margin:auto"><h2>'+escapeHtml_(title)+'</h2><p>'+escapeHtml_(message)+'</p></body></html>')}
function escapeHtml_(v){return String(v||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}

function authorizeServices(){
  DriveApp.getRootFolder().getName();
  MailApp.getRemainingDailyQuota();
  getOrCreateFolder_(DriveApp.getRootFolder(),APPROVAL_ROOT_FOLDER);
  getOrCreateFolder_(DriveApp.getRootFolder(),ARCHIVE_ROOT_FOLDER);
  return 'Authorization complete.';
}
