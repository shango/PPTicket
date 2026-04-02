function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function safeSubject(s: string): string {
  return s.replace(/[\r\n]/g, ' ').slice(0, 200);
}

interface EmailParams {
  to: string[];
  subject: string;
  html: string;
}

export async function sendEmail(apiKey: string, params: EmailParams): Promise<void> {
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PDO Kanban <noreply@pre-pro.cc>',
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    });
  } catch (e) {
    console.error('Email send failed:', e);
  }
}

export function newTicketEmail(ticketNumber: number, title: string, priority: string, submitterName: string, frontendUrl: string): { subject: string; html: string } {
  return {
    subject: safeSubject(`[PDO-${ticketNumber}] New ticket: ${title}`),
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">New Ticket Submitted</h2>
        <p><strong>PDO-${ticketNumber}:</strong> ${esc(title)}</p>
        <p><strong>Priority:</strong> ${esc(priority.toUpperCase())}</p>
        <p><strong>Submitted by:</strong> ${esc(submitterName)}</p>
        <p><a href="${esc(frontendUrl)}/board?ticket=PDO-${ticketNumber}" style="color: #6366f1;">View Ticket</a></p>
      </div>
    `,
  };
}

export function newUserEmail(name: string, email: string, frontendUrl: string): { subject: string; html: string } {
  return {
    subject: safeSubject(`New user signed in: ${name}`),
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">New User Signed Up</h2>
        <p><strong>Name:</strong> ${esc(name)}</p>
        <p><strong>Email:</strong> ${esc(email)}</p>
        <p>They have been assigned the <strong>Viewer</strong> role.</p>
        <p><a href="${esc(frontendUrl)}/admin" style="color: #6366f1;">Manage Users</a></p>
      </div>
    `,
  };
}

export function ticketAssignedEmail(ticketNumber: number, title: string, priority: string, edc: number | null, frontendUrl: string): { subject: string; html: string } {
  const edcStr = edc ? new Date(edc * 1000).toLocaleDateString() : 'None';
  return {
    subject: safeSubject(`You've been assigned PDO-${ticketNumber}`),
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">Ticket Assigned to You</h2>
        <p><strong>PDO-${ticketNumber}:</strong> ${esc(title)}</p>
        <p><strong>Priority:</strong> ${esc(priority.toUpperCase())}</p>
        <p><strong>Est. Completion:</strong> ${esc(edcStr)}</p>
        <p><a href="${esc(frontendUrl)}/board?ticket=PDO-${ticketNumber}" style="color: #6366f1;">View Ticket</a></p>
      </div>
    `,
  };
}

export function ticketStatusEmail(ticketNumber: number, title: string, newStatus: string, frontendUrl: string): { subject: string; html: string } {
  const statusLabel = newStatus === 'in_review' ? 'in review' : newStatus;
  return {
    subject: safeSubject(`Your ticket PDO-${ticketNumber} is ${statusLabel}`),
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">Ticket Status Update</h2>
        <p><strong>PDO-${ticketNumber}:</strong> ${esc(title)}</p>
        <p>Status changed to: <strong>${esc(statusLabel)}</strong></p>
        <p><a href="${esc(frontendUrl)}/board?ticket=PDO-${ticketNumber}" style="color: #6366f1;">View Ticket</a></p>
      </div>
    `,
  };
}

export function newCommentEmail(ticketNumber: number, title: string, authorName: string, commentBody: string, frontendUrl: string): { subject: string; html: string } {
  return {
    subject: safeSubject(`[PDO-${ticketNumber}] New comment on: ${title}`),
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">New Comment</h2>
        <p><strong>PDO-${ticketNumber}:</strong> ${esc(title)}</p>
        <p><strong>${esc(authorName)}</strong> commented:</p>
        <blockquote style="border-left: 3px solid #7c7fdf; margin: 12px 0; padding: 8px 12px; color: #a0a3af;">${esc(commentBody)}</blockquote>
        <p><a href="${esc(frontendUrl)}/board?ticket=PDO-${ticketNumber}" style="color: #6366f1;">View Ticket</a></p>
      </div>
    `,
  };
}
