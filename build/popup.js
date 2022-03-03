let output_versions = document.getElementById('versions');
let output_svg = document.getElementById('svg-output');

const { getFromStorage, setToStorage, getCurrentTabRootDomainFromStorage } = Utils;

getCurrentTabRootDomainFromStorage().then(({ storage }) => {
  if (storage) {
    const { hasTailwindCss, versions } = storage;
    hasTailwindCss ? has_tailwind_html(versions) : no_tailwind();
  } else {
    no_tailwind();
  }
});

function has_tailwind_html(versions) {
  output_svg.classList.remove('bg-red-100');
  output_svg.classList.add('bg-green-100');

  output_svg.innerHTML = `
  <svg class="h-6 w-6 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
    stroke="currentColor" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
  </svg>`;

  has_version(versions);
}

function has_version(versions) {
  output_versions.innerHTML = `<div class="mt-3 text-center">
    <h3 class="text-lg leading-6 font-medium text-gray-900">${versions.length ? versions.join(', ') : 'No version detected'}</h3>
  </div>`;
}

function no_tailwind() {
  output_svg.classList.add('bg-red-100');
  output_svg.classList.remove('bg-green-100');

  output_svg.innerHTML = `<svg class="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
   </svg>`;

  output_versions.innerHTML = `<div class="mt-3 text-center">
      <h3 class="text-lg leading-6 font-medium text-gray-900">No Tailwind CSS detected</h3>
    </div>`;
}
