const dashboardMain = document.getElementById('user-dashboard-main');
const dashboardHomeMarkup = dashboardMain?.innerHTML;
const dashboardNav = document.querySelector('nav[data-active-classes]');
const dashboardActiveClasses = dashboardNav?.dataset.activeClasses.split(/\s+/) ?? [];
const dashboardNavLinks = dashboardNav
  ? [...dashboardNav.querySelectorAll('[data-path]')].map((link) => ({
      link,
      markup: [...link.classList]
        .filter((className) => !dashboardActiveClasses.includes(className))
        .join(' '),
      active: link.dataset.path === 'tong-quan-ho-so'
    }))
  : [];

let applicationViewPromise;
let applicationViewOpen = false;
let applicationInteractionsLoaded = false;

const applicationColorClasses = {
  'bg-primary': 'bg-red-700',
  'bg-primary-container': 'bg-red-900',
  'bg-primary-hover': 'bg-red-800',
  'hover:bg-primary-hover': 'hover:bg-red-800',
  'text-primary': 'text-red-700',
  'text-primary-container': 'text-red-900',
  'hover:text-primary': 'hover:text-red-700',
  'border-primary': 'border-red-700',
  'text-secondary': 'text-slate-600',
  'text-on-surface': 'text-slate-900',
  'text-on-surface-variant': 'text-slate-600',
  'bg-surface-panel': 'bg-white',
  'bg-surface-subtle': 'bg-slate-50',
  'border-border-subtle': 'border-slate-200',
  'text-state-success': 'text-green-700',
  'bg-state-success': 'bg-green-600',
  'text-tertiary-fixed': 'text-amber-400'
};

function setActiveNavigation(isApplicationView) {
  dashboardNavLinks.forEach(({ link, markup, active }) => {
    link.className = markup;
    const isCurrent = isApplicationView
      ? link.dataset.path === 'nop-ho-so-truc-tuyen'
      : active;

    if (isCurrent) {
      link.classList.add(...dashboardActiveClasses);
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

function recolorApplicationMarkup(root) {
  root.querySelectorAll('[class]').forEach((element) => {
    [...element.classList].forEach((className) => {
      const replacement = applicationColorClasses[className];
      if (replacement) {
        element.classList.remove(className);
        element.classList.add(replacement);
      }
    });
  });
}

async function loadApplicationView() {
  if (!applicationViewPromise) {
    applicationViewPromise = fetch('/api/application-submission-view')
      .then(async (response) => {
        if (!response.ok) throw new Error('Không tải được nội dung nộp hồ sơ.');
        const documentPage = new DOMParser().parseFromString(await response.text(), 'text/html');
        const submissionMain = documentPage.getElementById('application-submission-main');
        const successModal = documentPage.getElementById('success-modal');
        const interactions = [...documentPage.scripts].find((script) =>
          script.textContent.includes('const citizenDatabase')
        );

        if (!submissionMain || !successModal || !interactions) {
          throw new Error('Nội dung nộp hồ sơ chưa sẵn sàng.');
        }

        return {
          content: submissionMain.innerHTML,
          modal: successModal.outerHTML,
          interactions: interactions.textContent
        };
      })
      .catch((error) => {
        applicationViewPromise = undefined;
        throw error;
      });
  }

  return applicationViewPromise;
}

async function showApplicationView() {
  if (!dashboardMain) return;

  setActiveNavigation(true);
  dashboardMain.innerHTML = '<div class="mx-auto max-w-7xl px-4 py-12 text-center text-slate-600">Đang mở biểu mẫu nộp hồ sơ...</div>';

  try {
    const view = await loadApplicationView();
    dashboardMain.innerHTML = `<div class="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">${view.content}</div>${view.modal}`;
    recolorApplicationMarkup(dashboardMain);
    applicationViewOpen = true;

    if (!applicationInteractionsLoaded) {
      const script = document.createElement('script');
      script.textContent = view.interactions;
      document.body.append(script);
      applicationInteractionsLoaded = true;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    dashboardMain.innerHTML = `<div role="alert" class="mx-auto max-w-7xl px-4 py-12 text-center text-red-700">${error.message}</div>`;
    applicationViewOpen = false;
  }
}

function showDashboardView() {
  if (!dashboardMain || !applicationViewOpen) return;
  if (window.location.pathname === '/applicationSubmission') {
    window.location.assign('/user-dashboard');
    return;
  }
  dashboardMain.innerHTML = dashboardHomeMarkup;
  applicationViewOpen = false;
  setActiveNavigation(false);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('click', (event) => {
  const dashboardLink = event.target.closest('a[href="/user-dashboard"]');
  if (dashboardLink && dashboardMain && applicationViewOpen) {
    event.preventDefault();
    showDashboardView();
  }
});

if (window.location.pathname === '/applicationSubmission') {
  showApplicationView();
}
