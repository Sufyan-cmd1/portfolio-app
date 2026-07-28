const API = '/api/projects';
let projects = [];
let adminToken = null;

// DOM refs
const categoriesWrapper = document.getElementById('categories');
const modal = document.getElementById('projectModal');
const modalBody = document.querySelector('.modal__body');
const modalClose = document.querySelector('.modal__close');
const adminSection = document.getElementById('admin');
const adminToggle = document.getElementById('adminToggle');
const authStatus = document.getElementById('authStatus');
const authBtn = document.getElementById('authBtn');
const form = document.getElementById('projectForm');
const formId = document.getElementById('formId');
const formTitle = document.getElementById('formProjectTitle');
const formCategory = document.getElementById('formCategory');
const formDescription = document.getElementById('formDescription');
const formImage = document.getElementById('formImage');
const cancelBtn = document.getElementById('cancelEdit');
const adminList = document.getElementById('adminList');
const contactForm = document.getElementById('contactForm');
const contactStatus = document.getElementById('contactStatus');

// ── Category Background Images (Cloudinary) ──
const categoryBgImages = {
  'Logo Design': 'https://res.cloudinary.com/yfcvzvme/image/upload/v1785159539/logo-bg_sb1hif.png',
  'Illustration': 'https://res.cloudinary.com/yfcvzvme/image/upload/v1785159547/illustration-bg_z8rush.png',
  'Mascot': 'https://res.cloudinary.com/yfcvzvme/image/upload/v1785159540/mascot-bg_fcjldp.png',
  'Poster': 'https://res.cloudinary.com/yfcvzvme/image/upload/v1785159536/posters-bg_z9ws7k.png',
  'Post': 'https://res.cloudinary.com/yfcvzvme/image/upload/v1785159537/post-bg_ak1zbt.png',
  'watercolor Logo Design': 'https://res.cloudinary.com/yfcvzvme/image/upload/v1785159544/watercolor-logo-bg_brqt6c.png',
};
const defaultBgImage = 'https://res.cloudinary.com/yfcvzvme/image/upload/v1785159538/q_innor8.jpg';

// ── Auth ──
function setAuth(status, token = null) {
  adminToken = token;
  if (authStatus) {
    authStatus.textContent = status ? '✅ Authenticated' : '🔒 Not authenticated';
    authStatus.style.color = status ? '#2ecc71' : '#555';
  }
  if (authBtn) authBtn.textContent = status ? 'Logout' : 'Login';
  if (status) loadProjects();
  else adminList.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#888;padding:2rem 0;">🔒 Please login to manage projects.</p>';
}

async function checkAuth() {
  if (adminToken) { setAuth(true, adminToken); return; }
  setAuth(false);
}

authBtn?.addEventListener('click', () => {
  if (adminToken) {
    adminToken = null;
    setAuth(false);
    document.location.reload();
  } else {
    const password = prompt('Enter admin password:');
    if (!password) return;
    fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAuth(true, data.token);
          loadProjects();
          showNotification('✅ Logged in!');
        } else {
          showNotification('❌ Invalid password.', 'error');
        }
      })
      .catch(() => showNotification('❌ Login failed.', 'error'));
  }
});

async function apiFetch(url, options = {}) {
  const headers = options.headers || {};
  if (adminToken) headers['x-admin-token'] = adminToken;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    setAuth(false);
    showNotification('🔒 Authentication failed.', 'error');
    throw new Error('Unauthorized');
  }
  return res;
}

async function loadProjects() {
  try {
    const res = await fetch(API);
    if (res.ok) {
      projects = await res.json();
      projects.sort((a, b) => (b.createdAt || b._id).localeCompare(a.createdAt || a._id));
      renderCategories();
      if (adminToken) renderAdminList();
    }
  } catch (e) { console.error(e); }
}

function renderCategories() {
  const categories = [...new Set(projects.map(p => p.category))].filter(Boolean);
  categories.sort((a, b) => {
    if (a === 'Logo Design') return -1;
    if (b === 'Logo Design') return 1;
    return a.localeCompare(b);
  });

  if (!categories.length) {
    categoriesWrapper.innerHTML = `<p style="text-align:center;padding:4rem 0;color:#888;">No projects yet. Add your first project via the admin panel.</p>`;
    return;
  }

  let html = '';
  categories.forEach(cat => {
    const catProjects = projects.filter(p => p.category === cat);
    const slug = cat.toLowerCase().replace(/\s+/g, '-');
    const bgImage = categoryBgImages[cat] || defaultBgImage;

    html += `
      <section id="heading-${slug}" class="slide slide-category-heading">
        <div class="category-heading__bg" style="background-image: url('${bgImage}');"></div>
        <div class="container"><h2>${cat}</h2></div>
      </section>
      <section id="projects-${slug}" class="slide slide-projects">
        <div class="container">
          <div class="project-row-wrapper">
            <button class="scroll-btn scroll-btn--left" data-slug="${slug}"><i class="fas fa-chevron-left"></i></button>
            <div class="project-grid" id="grid-${slug}">
    `;
    catProjects.forEach(p => {
      const img = p.image ? `<img src="${p.image}" alt="${p.title}">` : `<div class="placeholder">🎨</div>`;
      html += `
        <div class="project-card" data-id="${p._id}">
          <div class="project-card__image-wrapper">
            <div class="project-card__mockup">${img}</div>
            <span class="project-card__badge">${p.category}</span>
          </div>
          <div class="project-card__body">
            <h3 class="project-card__title">${p.title}</h3>
            <p class="project-card__desc">${p.description ? p.description.substring(0, 100) + (p.description.length > 100 ? '…' : '') : ''}</p>
          </div>
        </div>
      `;
    });
    html += `
            </div>
            <button class="scroll-btn scroll-btn--right" data-slug="${slug}"><i class="fas fa-chevron-right"></i></button>
          </div>
        </div>
      </section>
    `;
  });

  categoriesWrapper.innerHTML = html;
  initScrollButtons();

  document.querySelectorAll('.project-card').forEach(el => {
    el.addEventListener('click', () => openModal(el.dataset.id));
  });
}

function initScrollButtons() {
  document.querySelectorAll('.scroll-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const grid = document.getElementById(`grid-${this.dataset.slug}`);
      if (!grid) return;
      const dir = this.classList.contains('scroll-btn--left') ? -1 : 1;
      const cardWidth = grid.querySelector('.project-card')?.offsetWidth || 280;
      const gap = 32;
      grid.scrollBy({ left: dir * (cardWidth + gap) * 3, behavior: 'smooth' });
    });
  });

  document.querySelectorAll('.project-grid').forEach(grid => {
    grid.addEventListener('scroll', function() {
      const wrapper = this.closest('.project-row-wrapper');
      if (!wrapper) return;
      const leftBtn = wrapper.querySelector('.scroll-btn--left');
      const rightBtn = wrapper.querySelector('.scroll-btn--right');
      if (!leftBtn || !rightBtn) return;
      const scrollLeft = this.scrollLeft;
      const maxScroll = this.scrollWidth - this.clientWidth;
      leftBtn.classList.toggle('hidden', scrollLeft <= 10);
      rightBtn.classList.toggle('hidden', scrollLeft >= maxScroll - 10);
    });
    setTimeout(() => grid.dispatchEvent(new Event('scroll')), 100);
  });
}

function openModal(id) {
  const project = projects.find(p => p._id === id);
  if (!project) return;
  const imgHtml = project.image ? `<img src="${project.image}" alt="${project.title}">` :
    `<div class="placeholder" style="aspect-ratio:4/3;background:#f0ede8;display:flex;align-items:center;justify-content:center;font-size:3rem;color:#8B0000;border-radius:16px;">🎨</div>`;
  modalBody.innerHTML = `
    ${imgHtml}
    <h2>${project.title}</h2>
    <div class="modal-meta">${project.category} · ${project.createdAt || ''}</div>
    <div class="modal-description">${project.description || 'No description provided.'}</div>
  `;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modal.classList.remove('active');
  document.body.style.overflow = '';
}
modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// ── Admin Toggle ──
adminToggle.addEventListener('click', (e) => {
  e.preventDefault();
  if (adminToken) {
    if (adminSection.style.display === 'block') {
      adminSection.style.display = 'none';
      adminToggle.textContent = 'Admin';
    } else {
      adminSection.style.display = 'block';
      adminToggle.textContent = 'Close Admin';
      loadProjects();
    }
  } else {
    const password = prompt('Enter admin password:');
    if (!password) return;
    fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAuth(true, data.token);
          adminSection.style.display = 'block';
          adminToggle.textContent = 'Close Admin';
          loadProjects();
          showNotification('✅ Logged in!');
        } else {
          showNotification('❌ Invalid password.', 'error');
        }
      })
      .catch(() => showNotification('❌ Login failed.', 'error'));
  }
});

// ── Form Submit ──
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!adminToken) { showNotification('🔒 Please login first.', 'error'); return; }
  const id = formId.value;
  const fd = new FormData();
  fd.append('title', formTitle.value);
  fd.append('category', formCategory.value);
  fd.append('description', formDescription.value);
  if (formImage.files[0]) fd.append('image', formImage.files[0]);
  const url = id ? `${API}/${id}` : API;
  const method = id ? 'PUT' : 'POST';
  try {
    const res = await apiFetch(url, { method, body: fd });
    if (res.ok) {
      resetForm();
      await loadProjects();
      showNotification('✅ Project saved!');
    } else {
      const err = await res.json().catch(() => ({}));
      showNotification(`❌ ${err.error || 'Error saving.'}`, 'error');
    }
  } catch (err) {
    if (err.message !== 'Unauthorized') showNotification('❌ Network error.', 'error');
  }
});

function editProject(id) {
  if (!adminToken) { showNotification('🔒 Please login first.', 'error'); return; }
  const p = projects.find(proj => proj._id === id);
  if (!p) return;
  formId.value = id;
  formTitle.value = p.title;
  formCategory.value = p.category;
  formDescription.value = p.description || '';
  formImage.value = '';
  document.querySelector('.admin__form h3').textContent = '✎ Edit Project';
  cancelBtn.style.display = 'inline-block';
  adminSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function deleteProject(id) {
  if (!adminToken) { showNotification('🔒 Please login first.', 'error'); return; }
  if (!confirm('Delete this project?')) return;
  try {
    const res = await apiFetch(`${API}/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await loadProjects();
      showNotification('🗑️ Deleted!');
    } else {
      showNotification('❌ Error deleting.', 'error');
    }
  } catch (err) {
    if (err.message !== 'Unauthorized') showNotification('❌ Network error.', 'error');
  }
}

function renderAdminList() {
  if (!adminToken) {
    adminList.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#888;padding:2rem 0;">🔒 Please login.</p>';
    return;
  }
  if (!projects.length) {
    adminList.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#888;padding:2rem 0;">No projects yet.</p>';
    return;
  }
  adminList.innerHTML = projects.map(p => `
    <div class="admin-item">
      <div class="admin-item__info">
        <div class="admin-item__title">${p.title}</div>
        <div class="admin-item__category">${p.category}</div>
      </div>
      <div class="admin-item__actions">
        <button class="edit-btn" data-id="${p._id}">✎ Edit</button>
        <button class="delete-btn" data-id="${p._id}">✕ Delete</button>
      </div>
    </div>
  `).join('');
  document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => editProject(btn.dataset.id)));
  document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', () => deleteProject(btn.dataset.id)));
}

cancelBtn.addEventListener('click', resetForm);
function resetForm() {
  form.reset();
  formId.value = '';
  document.querySelector('.admin__form h3').textContent = 'Add New Project';
  cancelBtn.style.display = 'none';
}

function showNotification(msg, type = 'success') {
  const old = document.querySelector('.notification');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'notification';
  el.textContent = msg;
  Object.assign(el.style, {
    position: 'fixed',
    bottom: '2rem',
    right: '2rem',
    padding: '1rem 1.5rem',
    borderRadius: '12px',
    background: type === 'error' ? '#e74c3c' : '#2ecc71',
    color: '#fff',
    fontWeight: '500',
    boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
    zIndex: '9999',
    animation: 'fadeInUp 0.3s ease',
  });
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
}

// ── Contact Form ──
contactForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('contactName').value.trim();
  const email = document.getElementById('contactEmail').value.trim();
  const phone = document.getElementById('contactPhone').value.trim();
  const message = document.getElementById('contactMessage').value.trim();
  if (!name || !email || !message) {
    contactStatus.textContent = '❌ Please fill all required fields.';
    contactStatus.className = 'contact__status error';
    return;
  }
  contactStatus.textContent = '⏳ Sending...';
  contactStatus.className = 'contact__status';
  contactStatus.style.display = 'block';
  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, message }),
    });
    const data = await res.json();
    if (res.ok) {
      contactStatus.textContent = '✅ ' + data.message;
      contactStatus.className = 'contact__status success';
      contactForm.reset();
    } else {
      contactStatus.textContent = '❌ ' + (data.error || 'Something went wrong.');
      contactStatus.className = 'contact__status error';
    }
  } catch {
    contactStatus.textContent = '❌ Network error.';
    contactStatus.className = 'contact__status error';
  }
});

// ── Smooth scroll ──
document.querySelectorAll('.header__nav a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    if (link.id === 'adminToggle') return;
    e.preventDefault();
    const targetId = link.getAttribute('href').substring(1);
    if (targetId === 'categories') {
      const firstHeading = document.querySelector('.slide-category-heading');
      if (firstHeading) firstHeading.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const el = document.getElementById(targetId);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  });
});

// ── Init ──
loadProjects();
resetForm();
checkAuth();

window.navigateTo = (id) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
};