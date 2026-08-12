class FriinkHeader extends HTMLElement {
	connectedCallback() {
		this.style.display = 'contents';
		const isComingSoonPage = window.location.pathname.endsWith('coming-soon.html');
		this.innerHTML = `
			<header class="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-container-padding-mobile md:px-container-padding-desktop h-20 bg-surface/60 backdrop-blur-xl shadow-sm border-b border-outline-variant">
				<a href="index.html" aria-label="Friink home">
					<picture>
						<source media="(prefers-color-scheme: dark)" srcset="assets/brand/logoTextBlack.svg">
						<img src="assets/brand/logoText065.svg" alt="Friink" class="header-logo h-10 w-auto">
					</picture>
				</a>
				${isComingSoonPage ? '' : '<a class="bg-primary text-on-primary px-6 py-2 rounded-full font-label-md text-label-md transition-colors hover:bg-primary/90" href="coming-soon.html">Early Access</a>'}
			</header>`;
	}
}

class FriinkProgress extends HTMLElement {
	connectedCallback() {
		this.style.display = 'contents';
		this.innerHTML = `
			<section class="px-container-padding-mobile md:px-container-padding-desktop max-w-4xl mx-auto mt-section-gap" aria-labelledby="development-heading">
				<div class="bg-surface rounded-xl p-8 shadow-[0_4px_24px_rgba(0,107,95,0.1)] border-t-2 border-outline-variant">
					<div class="flex justify-between items-end mb-4">
						<div>
							<h2 id="development-heading" class="text-headline-md font-headline-md text-on-surface">Under Development</h2>
							<p class="text-body-md font-body-md text-on-surface-variant mt-1">Laying the foundation for a better space.</p>
						</div>
						<span class="text-headline-lg font-headline-lg text-primary">10%</span>
					</div>
					<div class="h-4 w-full bg-surface-container-high rounded-full overflow-hidden" role="progressbar" aria-label="Development progress" aria-valuenow="10" aria-valuemin="0" aria-valuemax="100">
						<div class="h-full progress-shimmer rounded-full" style="width: 10%"></div>
					</div>
				</div>
			</section>`;
	}
}

class FriinkWaitlist extends HTMLElement {
	connectedCallback() {
		this.style.display = 'contents';
		this.innerHTML = `
			<section class="px-container-padding-mobile md:px-container-padding-desktop max-w-3xl mx-auto mt-section-gap text-center" aria-labelledby="waitlist-heading">
				<div class="bg-surface-container rounded-3xl p-12 shadow-sm border border-outline-variant">
					<span class="material-symbols-outlined text-display-lg text-primary mb-6" style="font-variation-settings: 'FILL' 1;">water_drop</span>
					<h2 id="waitlist-heading" class="text-headline-md font-headline-md text-on-surface mb-4">Be part of the beginning.</h2>
					<p class="text-body-md font-body-md text-on-surface-variant mb-8 max-w-md mx-auto">Join the waitlist to get notified when we open the doors.</p>
					<form class="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto">
						<label class="sr-only" for="waitlist-email">Your email address</label>
						<input id="waitlist-email" name="email" autocomplete="email" class="flex-1 bg-surface border-b-2 border-outline bg-transparent px-4 py-3 text-body-md focus:outline-none focus:border-primary focus:ring-0 transition-colors rounded-t-md" placeholder="Your email address" required type="email">
						<button class="bg-primary text-on-primary px-8 py-3 rounded-full font-label-md text-label-md whitespace-nowrap transition-colors hover:bg-primary/90" type="submit">Join Waitlist</button>
					</form>
				</div>
			</section>`;

		this.querySelector('form').addEventListener('submit', (event) => {
			event.preventDefault();
			const form = event.currentTarget;
			const button = form.querySelector('button');
			button.textContent = 'You are on the list';
			button.disabled = true;
			form.querySelector('input').disabled = true;
		});
	}
}

class FriinkFooter extends HTMLElement {
	connectedCallback() {
		this.style.display = 'contents';
		this.innerHTML = `
			<footer class="w-full py-gutter px-container-padding-mobile md:px-container-padding-desktop flex flex-col md:flex-row justify-between items-center gap-base bg-surface-container-low border-t border-outline-variant">
				<img src="assets/brand/logoTextBlack.svg" alt="Friink" class="footer-logo h-10 w-auto">
				<p class="text-body-md font-body-md text-on-surface-variant">&copy; 2026 Friink. Built for humans.</p>
			</footer>`;
	}
}

customElements.define('friink-header', FriinkHeader);
customElements.define('friink-progress', FriinkProgress);
customElements.define('friink-waitlist', FriinkWaitlist);
customElements.define('friink-footer', FriinkFooter);
