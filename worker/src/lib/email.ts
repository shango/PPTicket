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
        from: 'PDO Kanban <noreply@pdoexperts.fb.com>',
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
    subject: `[PDO-${ticketNumber}] New ticket: ${title}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">New Ticket Submitted</h2>
        <p><strong>PDO-${ticketNumber}:</strong> ${title}</p>
        <p><strong>Priority:</strong> ${priority.toUpperCase()}</p>
        <p><strong>Submitted by:</strong> ${submitterName}</p>
        <p><a href="${frontendUrl}/board?ticket=PDO-${ticketNumber}" style="color: #6366f1;">View Ticket</a></p>
      </div>
    `,
  };
}

export function newUserEmail(name: string, email: string, frontendUrl: string): { subject: string; html: string } {
  return {
    subject: `New user signed in: ${name}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">New User Signed Up</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p>They have been assigned the <strong>Viewer</strong> role.</p>
        <p><a href="${frontendUrl}/admin" style="color: #6366f1;">Manage Users</a></p>
      </div>
    `,
  };
}

export function ticketAssignedEmail(ticketNumber: number, title: string, priority: string, dueDate: number | null, frontendUrl: string): { subject: string; html: string } {
  const dueDateStr = dueDate ? new Date(dueDate * 1000).toLocaleDateString() : 'None';
  return {
    subject: `You've been assigned PDO-${ticketNumber}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">Ticket Assigned to You</h2>
        <p><strong>PDO-${ticketNumber}:</strong> ${title}</p>
        <p><strong>Priority:</strong> ${priority.toUpperCase()}</p>
        <p><strong>Due:</strong> ${dueDateStr}</p>
        <p><a href="${frontendUrl}/board?ticket=PDO-${ticketNumber}" style="color: #6366f1;">View Ticket</a></p>
      </div>
    `,
  };
}

export function ticketStatusEmail(ticketNumber: number, title: string, newStatus: string, frontendUrl: string): { subject: string; html: string } {
  const statusLabel = newStatus === 'in_review' ? 'in review' : newStatus;
  return {
    subject: `Your ticket PDO-${ticketNumber} is ${statusLabel}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">Ticket Status Update</h2>
        <p><strong>PDO-${ticketNumber}:</strong> ${title}</p>
        <p>Status changed to: <strong>${statusLabel}</strong></p>
        <p><a href="${frontendUrl}/board?ticket=PDO-${ticketNumber}" style="color: #6366f1;">View Ticket</a></p>
      </div>
    `,
  };
}
