// MIDAS Viewer

let conversations = [];
let treasury = null;

// Fetch conversations
async function loadConversations() {
    try {
        const response = await fetch('/api/conversations');
        conversations = await response.json();
        render();
    } catch (err) {
        document.getElementById('conversations').innerHTML =
            '<p class="empty">No conversations yet.<br>Run: python orchestrator.py</p>';
    }
}

// Fetch treasury balance (live from Solana wallet)
async function loadTreasury() {
    try {
        const response = await fetch('/api/treasury');
        treasury = await response.json();
        updateTreasuryDisplay();
    } catch (err) {
        console.log('Treasury fetch failed:', err);
    }
}

function updateTreasuryDisplay() {
    const treasuryEl = document.getElementById('treasury');
    const progressEl = document.getElementById('progress');
    const spentEl = document.getElementById('spent');
    const revenueEl = document.getElementById('revenue');
    const netEl = document.getElementById('net');
    const netItem = document.querySelector('.ledger-item.net');

    if (treasury) {
        // Update main treasury display
        if (treasury.current_value) {
            treasuryEl.textContent = `$${treasury.current_value.toLocaleString()}`;
        } else if (treasury.balance && !treasury.balance.error) {
            treasuryEl.textContent = `$${treasury.balance.usd.toLocaleString()}`;
            treasuryEl.title = `${treasury.balance.sol} SOL`;
        }

        if (progressEl) {
            progressEl.style.width = `${treasury.progress}%`;
        }

        // Update ledger display
        if (treasury.ledger) {
            const ledger = treasury.ledger;
            spentEl.textContent = `-$${ledger.total_spent.toLocaleString()}`;
            revenueEl.textContent = `+$${ledger.total_revenue.toLocaleString()}`;

            const netChange = ledger.net_change;
            const netSign = netChange >= 0 ? '+' : '';
            netEl.textContent = `${netSign}$${netChange.toLocaleString()}`;

            // Color the net based on positive/negative
            if (netItem) {
                netItem.classList.remove('positive', 'negative');
                if (netChange > 0) netItem.classList.add('positive');
                else if (netChange < 0) netItem.classList.add('negative');
            }
        }
    } else if (conversations.length > 0) {
        // Fallback to conversation data
        const latest = conversations[0];
        treasuryEl.textContent = `$${(latest.treasury || 1000).toLocaleString()}`;
    }
}

function render() {
    const container = document.getElementById('conversations');

    if (conversations.length === 0) {
        container.innerHTML = '<p class="empty">No conversations yet.<br>Run: python orchestrator.py</p>';
        return;
    }

    // Update day from most recent conversation
    const latest = conversations[0];
    document.getElementById('day').textContent = latest.day || 1;

    // Treasury is handled by loadTreasury, but fallback here
    if (!treasury) {
        document.getElementById('treasury').textContent = `$${(latest.treasury || 1000).toLocaleString()}`;
    }

    container.innerHTML = conversations.map((conv, i) => {
        const date = conv.started_at ? new Date(conv.started_at).toLocaleDateString() : '';
        return `
            <div class="card" onclick="openModal(${i})">
                <div class="card-title">${escapeHtml(conv.topic || 'Conversation')}</div>
                <div class="card-meta">Day ${conv.day} · ${conv.turn_count || 0} turns${date ? ' · ' + date : ''}</div>
            </div>
        `;
    }).join('');
}

function openModal(index) {
    const conv = conversations[index];
    if (!conv) return;

    document.getElementById('modal-title').textContent = conv.topic || 'Conversation';
    document.getElementById('modal-meta').textContent = `Day ${conv.day} · Treasury: $${(conv.treasury || 1000).toLocaleString()}`;

    const messagesHtml = (conv.messages || []).map(msg => {
        // Handle both "advisor" and "claude" agent names
        const agent = msg.agent === 'advisor' ? 'claude' : (msg.agent || 'unknown');
        const label = agent === 'midas' ? 'Midas' : 'Claude';
        return `
            <div class="msg ${agent}">
                <div class="msg-name">${label}</div>
                <div class="msg-bubble">
                    <div class="msg-text">${formatContent(msg.content)}</div>
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('modal-messages').innerHTML = messagesHtml;
    document.getElementById('modal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modal').classList.remove('open');
    document.body.style.overflow = '';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function formatContent(text) {
    if (!text) return '';
    // Escape HTML then convert markdown-style formatting
    let html = escapeHtml(text);
    // Bold **text**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Line breaks
    html = html.replace(/\n/g, '<br>');
    return html;
}

// Close on escape or backdrop click
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
document.getElementById('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

// Load on start
loadConversations();
loadTreasury();

// Refresh treasury every 30 seconds for live updates
setInterval(loadTreasury, 30000);
