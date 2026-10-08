
/*
 * 記事の追加方法:
 * articles フォルダー直下に front matter 付きの Markdown ファイルを作成します。
 * articles/index.json は Amplify のビルド時に自動生成されます。
 */
let articles = [];

// Global State Variables
let currentFilter = 'all';
let currentActiveArticleId = null;

window.addEventListener('DOMContentLoaded', () => {
    if (history.state?.view !== 'summary') {
        history.replaceState({ view: 'summary', category: 'all' }, '', window.location.href);
    } else if (history.state.category) {
        currentFilter = history.state.category;
    }
    window.addEventListener('popstate', event => {
        if (event.state?.view === 'article') {
            renderDetailPage(event.state.articleId);
        } else {
            currentFilter = event.state?.category || 'all';
            renderSummaryView();
        }
    });
    loadArticles();
});

async function loadArticles() {
    const grid = document.getElementById('articles-grid');
    const emptyState = document.getElementById('empty-state');

    try {
        const manifestUrl = new URL('articles/index.json', document.baseURI);
        const manifestResponse = await fetch(manifestUrl);
        if (!manifestResponse.ok) {
            throw new Error(`記事一覧を読み込めませんでした (${manifestResponse.status})`);
        }

        const articlePaths = await manifestResponse.json();
        if (!Array.isArray(articlePaths) || articlePaths.some(path => typeof path !== 'string')) {
            throw new Error('articles/index.json は Markdown ファイル名の配列にしてください');
        }

        articles = await Promise.all(articlePaths.map(async path => {
            const articleUrl = new URL(path, manifestUrl);
            const response = await fetch(articleUrl);
            if (!response.ok) {
                throw new Error(`${path} を読み込めませんでした (${response.status})`);
            }
            const article = parseMarkdownArticle(await response.text(), path);
            if (article.image) {
                const imagePath = article.image.replace(/\\/g, '/');
                const imageBase = imagePath.startsWith('/') || imagePath.startsWith('articles/')
                    ? document.baseURI
                    : articleUrl;
                article.image = new URL(imagePath.replace(/^\/+/, ''), imageBase).href;
            }
            return article;
        }));
        articles.sort((a, b) => Number(b.id) - Number(a.id));
        renderCategoryTabs();
        renderSummaryPage();
    } catch (error) {
        console.error('記事の読み込みに失敗しました:', error);
        grid.innerHTML = '';
        emptyState.classList.remove('hidden');
        emptyState.querySelector('h3').innerText = '記事を読み込めませんでした';
        emptyState.querySelector('p').innerText = 'HTTP サーバー経由で開き、articles/index.json と Markdown ファイルを確認してください。';
    }
}

function parseMarkdownArticle(markdown, path) {
    const match = markdown.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
    if (!match) {
        throw new Error(`${path} に YAML front matter（先頭の ---）がありません`);
    }

    const metadata = {};
    match[1].split(/\r?\n/).forEach(line => {
        const field = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
        if (!field) {
            throw new Error(`${path} の front matter を解析できません: ${line}`);
        }
        const [, key, rawValue] = field;
        try {
            metadata[key] = rawValue.startsWith('[') ? JSON.parse(rawValue) : rawValue.replace(/^["']|["']$/g, '');
        } catch (error) {
            throw new Error(`${path} の ${key} を解析できません: ${error.message}`);
        }
    });

    for (const key of ['id', 'title', 'category', 'date']) {
        if (!metadata[key]) {
            throw new Error(`${path} に必須項目 ${key} がありません`);
        }
    }
    if (!['game', 'card', 'diary'].includes(metadata.category)) {
        throw new Error(`${path} の category は game、card、diary のいずれかにしてください`);
    }

    return {
        ...metadata,
        id: String(metadata.id),
        body: match[2].trim()
    };
}

window.addEventListener('scroll', () => {
    const backToTopBtn = document.getElementById('btn-back-to-top');
    if (backToTopBtn) {
        if (window.scrollY > 200) {
            backToTopBtn.classList.remove('opacity-0', 'pointer-events-none');
            backToTopBtn.classList.add('opacity-100');
        } else {
            backToTopBtn.classList.remove('opacity-100');
            backToTopBtn.classList.add('opacity-0', 'pointer-events-none');
        }
    }
});

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showSummaryPage() {
    if (history.state?.view === 'article') {
        history.back();
        return;
    }
    renderSummaryView();
}

function renderSummaryView() {
    document.getElementById('view-summary').classList.remove('hidden');
    document.getElementById('view-detail').classList.add('hidden');
    currentActiveArticleId = null;
    updateCategorySelection(currentFilter);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderSummaryPage();
}

function showDetailPage(articleId) {
    const article = articles.find(a => a.id === articleId);
    if (!article) return;

    if (history.state?.view !== 'article' || history.state.articleId !== articleId) {
        history.pushState({ view: 'article', articleId }, '', window.location.href);
    }
    renderDetailPage(articleId);
}

function renderDetailPage(articleId) {
    const article = articles.find(a => a.id === articleId);
    if (!article) {
        renderSummaryView();
        return;
    }

    currentActiveArticleId = articleId;

    // Populate Detail Elements
    document.getElementById('detail-title').innerText = article.title;
    document.getElementById('detail-date').innerHTML = `<i class="fa-regular fa-calendar"></i> ${article.date}`;
    document.getElementById('detail-image').src = article.image || 'https://placehold.co/800x400/FFFBEA/F59E0B?text=No+Image';

    // Render Markdown
    document.getElementById('detail-body').innerHTML = typeof marked !== 'undefined' ? marked.parse(article.body) : article.body;

    document.getElementById('detail-like-count').innerText = article.likes || 0;

    // Category Badge
    const badge = document.getElementById('detail-category-badge');
    if (article.category === 'game') {
        badge.innerText = '🎮 ゲーム感想';
        badge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200';
    } else if (article.category === 'card') {
        badge.innerText = '🎴 カード開封結果';
        badge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200';
    } else {
        badge.innerText = '☕ 雑記';
        badge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200';
    }



    // Toggle view visibility
    document.getElementById('view-summary').classList.add('hidden');
    document.getElementById('view-detail').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderSummaryPage() {
    const grid = document.getElementById('articles-grid');
    const emptyState = document.getElementById('empty-state');
    grid.innerHTML = '';

    const filtered = articles.filter(a => currentFilter === 'all' || a.category === currentFilter);
    document.getElementById('article-count').innerText = `全 ${filtered.length} 件の記事`;

    if (filtered.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    } else {
        emptyState.classList.add('hidden');
    }

    filtered.forEach(item => {
        let catBadge = '';
        if (item.category === 'game') {
            catBadge = '<span class="bg-amber-100 text-amber-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">🎮 ゲーム感想</span>';
        } else if (item.category === 'card') {
            catBadge = '<span class="bg-rose-100 text-rose-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">🎴 カード開封</span>';
        } else {
            catBadge = '<span class="bg-sky-100 text-sky-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">☕ 雑記</span>';
        }

        // Plain text summary for grid view
        const plainText = item.body.replace(/[#*`>_-]/g, '');

        const card = document.createElement('div');
        card.className = 'bg-white rounded-3xl border-2 border-slate-100 overflow-hidden card-hover cursor-pointer flex flex-col justify-between shadow-xs';
        card.onclick = () => showDetailPage(item.id);

        card.innerHTML = `
    <div>
        <!-- Thumbnail Image -->
        <div class="h-44 w-full overflow-hidden bg-slate-100 relative">
            <img src="${item.image || 'https://placehold.co/600x400/FFFBEA/F59E0B?text=Blog'}" alt="アイキャッチ" class="w-full h-full object-cover">
                <div class="absolute top-3 left-3">${catBadge}</div>
        </div>

        <!-- Card Body -->
        <div class="p-5 space-y-2">
            <div class="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                <i class="fa-regular fa-calendar"></i> ${item.date}
            </div>
            <h2 class="font-black text-slate-800 text-base line-clamp-2 leading-snug hover:text-amber-600 transition-colors">
                ${item.title}
            </h2>
            <p class="text-xs text-slate-500 line-clamp-3 font-medium leading-relaxed">
                ${plainText}
            </p>
        </div>
    </div>

    <!-- Footer Meta -->
    <div class="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-400">
        <span class="flex items-center gap-1 text-rose-500">
            <i class="fa-solid fa-heart"></i> ${item.likes || 0}
        </span>
        <span class="text-amber-600 font-bold hover:underline">
            記事を読む <i class="fa-solid fa-chevron-right text-[10px]"></i>
        </span>
    </div>
    `;

        grid.appendChild(card);
    });
}

// カテゴリ一覧の件数と絞り込み操作を記事データに同期する
function renderCategoryTabs() {
    const tabs = document.getElementById('category-tabs');

    tabs.querySelectorAll('button[data-cat]').forEach(button => {
        button.addEventListener('click', () => filterCategory(button.dataset.cat));
    });
    tabs.querySelectorAll('[data-category-count]').forEach(count => {
        const category = count.dataset.categoryCount;
        count.innerText = category === 'all'
            ? articles.length
            : articles.filter(article => article.category === category).length;
    });
    filterCategory(currentFilter);
}

// Category Filter Handling
function filterCategory(cat) {
    if (cat !== currentFilter || history.state?.view !== 'summary') {
        history.pushState({ view: 'summary', category: cat }, '', window.location.href);
    }
    currentFilter = cat;
    updateCategorySelection(cat);
    renderSummaryView();
}

function updateCategorySelection(cat) {
    document.querySelectorAll('#category-tabs button[data-cat]').forEach(button => {
        const active = button.dataset.cat === cat;
        const wrapper = button.closest('a');
        const count = wrapper.querySelector('[data-category-count]');
        wrapper.classList.toggle('font-semibold', active);
        wrapper.classList.toggle('bg-brand-50/50', active);
        wrapper.classList.toggle('font-medium', !active);
        count.classList.toggle('bg-brand-500', active);
        count.classList.toggle('text-white', active);
        count.classList.toggle('bg-slate-100', !active);
        count.classList.toggle('text-slate-500', !active);
    });
}

function addLike() {
    if (!currentActiveArticleId) return;
    const article = articles.find(a => a.id === currentActiveArticleId);
    if (article) {
        const likes = Number(article.likes);
        article.likes = (Number.isFinite(likes) ? likes : 0) + 1;
        document.getElementById('detail-like-count').innerText = article.likes;
        showToast('❤️ いいね！を送信しました');
    }
}



function submitComment() {
    const input = document.getElementById('comment-input');
    const text = input.value.trim();
    if (!text || !currentActiveArticleId) return;

    const article = articles.find(a => a.id === currentActiveArticleId);
    if (article) {
        if (!article.comments) article.comments = [];
        article.comments.push(text);
        input.value = '';
        renderComments();
        showToast('💬 メモ・コメントを追加しました');
    }
}

// Copy Article Link Helper
function copyArticleLink() {
    const dummy = document.createElement('input');
    document.body.appendChild(dummy);
    dummy.value = window.location.href;
    dummy.select();
    document.execCommand('copy');
    document.body.removeChild(dummy);
    showToast('🔗 記事のURLをコピーしました');
}

// Custom Toast Notification Handler
function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast-enter bg-slate-800 text-white font-bold text-xs px-5 py-3 rounded-full shadow-lg flex items-center gap-2 pointer-events-auto border border-slate-700';
    toast.innerHTML = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.replace('toast-enter', 'toast-exit');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}
