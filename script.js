/**
 * whatwhatboy Gaming Community - Main Script
 * Consolidated vanilla JS (no jQuery) for the entire site.
 *
 * Modules:
 *  1. Sidebar Navigation
 *  2. Game Search + Category Filter
 *  3. Hero Typing Animation
 *  4. Stats Counter Animation
 *  5. Scroll Effects (fade-in, back-to-top)
 *  6. FAQ Accordion
 *  7. FAQ Search
 *  8. Service Worker Registration
 *  9. Smooth Scroll
 * 10. Blog Category Filter
 */

document.addEventListener('DOMContentLoaded', () => {
    initSiteBackground();
    initResponsiveShell();
    initResponsiveTables();
    initSidebar();
    if (!(window.WWB_HOST_CONSOLE === true || window.WhatsiteConsoleLite && window.WhatsiteConsoleLite.enabled)) initSearch();
    initSidebarGroups();
    if (!(window.WWB_HOST_CONSOLE === true || window.WhatsiteConsoleLite && window.WhatsiteConsoleLite.enabled)) {
        initHeroAnimations();
        initStatsCounters();
    }
    initScrollEffects();
    initFaqAccordion();
    initFaqSearch();
    initBlogFilter();
    if (!(window.WWB_HOST_CONSOLE === true || window.WhatsiteConsoleLite && window.WhatsiteConsoleLite.enabled)) initSmoothScroll();
    initServiceWorker();
});

function initResponsiveTables() {
    document.querySelectorAll('table').forEach((table) => {
        const scroller = table.parentElement;
        if (!scroller || scroller.hasAttribute('data-table-ready') ||
            !['auto', 'scroll'].includes(window.getComputedStyle(scroller).overflowX)) return;
        scroller.setAttribute('data-table-ready', '');
        scroller.classList.add('mobile-table-scroll');
        const ownsTabStop = !scroller.hasAttribute('tabindex');
        if (!scroller.hasAttribute('role')) scroller.setAttribute('role', 'region');
        if (!scroller.hasAttribute('aria-label') && !scroller.hasAttribute('aria-labelledby')) {
            const caption = table.querySelector('caption');
            scroller.setAttribute('aria-label', ((caption && caption.textContent.trim()) || 'Data table') + '. Scroll horizontally to see all columns.');
        }
        const update = () => {
            const overflow = scroller.scrollWidth > scroller.clientWidth + 1;
            scroller.setAttribute('data-table-overflow', String(overflow));
            if (ownsTabStop) {
                if (overflow) scroller.setAttribute('tabindex', '0');
                else scroller.removeAttribute('tabindex');
            }
        };
        update();
        if (typeof window.ResizeObserver === 'function') {
            const observer = new window.ResizeObserver(update);
            observer.observe(scroller);
            observer.observe(table);
        } else window.addEventListener('resize', update, {passive:true});
    });
}

// Keep regenerated pages connected to the shared appearance layer as well.
function initSiteBackground() {
    if (window.WWB_HOST_CONSOLE === true || window.WhatsiteConsoleLite && window.WhatsiteConsoleLite.enabled) return;
    const hasAsset = (selector, asset) => Array.from(document.querySelectorAll(selector))
        .some((element) => ((element.getAttribute('src') || element.getAttribute('href') || '').split('?')[0]).endsWith(asset));
    if (!hasAsset('link[rel="stylesheet"]', '/assets/site-background.css')) {
        const stylesheet = document.createElement('link');
        stylesheet.setAttribute('rel', 'stylesheet');
        stylesheet.setAttribute('href', '/assets/site-background.css?v=2');
        document.head.appendChild(stylesheet);
    }
    if (!hasAsset('script[src]', '/assets/site-background.js')) {
        const script = document.createElement('script');
        script.setAttribute('src', '/assets/site-background.js?v=2');
        script.defer = true;
        document.head.appendChild(script);
    }
}

// Generated pages may predate the static mobile integration. Keep the shared
// shell usable after a content rebuild without duplicating installed markup.
function initResponsiveShell() {
    const sidebar = document.getElementById('sidebar');
    const main = document.getElementById('main-content');
    const button = document.getElementById('mobile-sidebar-btn');
    if (!sidebar || !main || !button) return;

    const hasMobileStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .some((link) => (link.getAttribute('href') || '').split('?')[0].endsWith('assets/mobile.css'));
    if (!hasMobileStyles) {
        const stylesheet = document.createElement('link');
        stylesheet.setAttribute('rel', 'stylesheet');
        stylesheet.setAttribute('href', '/assets/mobile.css?v=3.3.8');
        document.head.appendChild(stylesheet);
    }
    if (!document.querySelector('link[href*="/assets/mobile-downloads.css"]')) {
        const styles = document.createElement('link');
        styles.setAttribute('rel','stylesheet');
        styles.setAttribute('href','/assets/mobile-downloads.css?v=3.3.8');
        document.head.appendChild(styles);
    }
    if (!document.querySelector('script[src*="/assets/mobile-downloads.js"]')) {
        const downloads = document.createElement('script');
        downloads.setAttribute('src','/assets/mobile-downloads.js?v=3.3.8');
        downloads.setAttribute('defer','');
        document.head.appendChild(downloads);
    }

    let header = button.closest('.mobile-site-header');
    if (!header) {
        header = document.createElement('header');
        header.className = 'mobile-site-header';
        button.parentElement.insertBefore(header, button);
        header.appendChild(button);
    }
    if (!header.querySelector('.mobile-brand')) {
        const brand = document.createElement('a');
        brand.className = 'mobile-brand';
        brand.setAttribute('href', '/');
        brand.setAttribute('aria-label', 'whatwhatboy home');
        const logo = document.createElement('img');
        Object.entries({ src: '/assets/images/logo.png', width: '26', height: '26', alt: '' })
            .forEach(([name, value]) => logo.setAttribute(name, value));
        const name = document.createElement('span');
        name.textContent = 'whatwhatboy';
        brand.appendChild(logo);
        brand.appendChild(name);
        header.appendChild(brand);
    }
    if (!document.querySelector('.skip-link')) {
        const skip = document.createElement('a');
        skip.className = 'skip-link';
        skip.setAttribute('href', '#main-content');
        skip.textContent = 'Skip to content';
        document.body.insertBefore(skip, document.body.firstChild);
    }
    if (main.tagName !== 'MAIN' && !main.hasAttribute('role')) main.setAttribute('role', 'main');
    if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');

    document.querySelectorAll('input').forEach((input) => {
        const placeholder = input.getAttribute('placeholder') || '';
        const search = input.getAttribute('type') === 'search' || /search/i.test(input.id + ' ' + input.className + ' ' + placeholder);
        if (search && !input.hasAttribute('aria-label') && !input.hasAttribute('aria-labelledby') && !input.labels?.length) {
            input.setAttribute('aria-label', placeholder || 'Search this page');
        }
    });
}

/* ==========================================================================
   1. Sidebar Navigation
   ========================================================================== */

function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebar-toggle');
    const mobileBtn = document.getElementById('mobile-sidebar-btn');
    const mainContent = document.getElementById('main-content');

    if (!sidebar || sidebar.dataset.navigationReady) return;
    sidebar.dataset.navigationReady = 'true';

    const STORAGE_KEY = 'sidebarCollapsed';
    const mobileViewport = window.matchMedia('(max-width: 1024px)');
    const bodyStyleKeys = ['position', 'top', 'left', 'right', 'width', 'overflow'];
    const backgroundState = new Map();
    let backdrop = null;
    let scrollLock = null;
    let previousFocus = null;
    let desktopCollapsed = false;
    try { desktopCollapsed = localStorage.getItem(STORAGE_KEY) === 'true'; } catch (e) { /* storage can be unavailable */ }

    // ---- helpers ----------------------------------------------------------

    /** Lazily create (or return existing) backdrop overlay for mobile. */
    const getBackdrop = () => {
        if (backdrop) return backdrop;
        backdrop = document.createElement('div');
        backdrop.className = 'sidebar-backdrop';
        backdrop.setAttribute('aria-hidden', 'true');
        document.body.appendChild(backdrop);
        backdrop.addEventListener('click', () => closeMobileSidebar());
        return backdrop;
    };

    const isMobile = () => mobileViewport.matches;

    const setBackgroundInert = (locked) => {
        if (locked) {
            Array.from(document.body.children).forEach((element) => {
                if (element === sidebar || element.contains(sidebar) || element === backdrop || /^(SCRIPT|STYLE|LINK)$/.test(element.tagName)) return;
                backgroundState.set(element, element.inert);
                element.inert = true;
            });
        } else {
            backgroundState.forEach((inert, element) => { element.inert = inert; });
            backgroundState.clear();
        }
    };

    // Fixed positioning also prevents the document behind the drawer moving on iOS.
    const lockScroll = () => {
        if (scrollLock) return;
        scrollLock = {
            x: window.scrollX,
            y: window.scrollY,
            styles: Object.fromEntries(bodyStyleKeys.map((key) => [key, document.body.style[key]]))
        };
        Object.assign(document.body.style, {
            position: 'fixed', top: `-${scrollLock.y}px`, left: '0', right: '0', width: '100%', overflow: 'hidden'
        });
        document.body.classList.add('sidebar-open');
    };

    const unlockScroll = () => {
        if (!scrollLock) return;
        const saved = scrollLock;
        scrollLock = null;
        Object.assign(document.body.style, saved.styles);
        document.body.classList.remove('sidebar-open');
        const behavior = document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = 'auto';
        window.scrollTo(saved.x, saved.y);
        document.documentElement.style.scrollBehavior = behavior;
    };

    // ---- desktop ---------------------------------------------------------

    const toggleDesktop = () => {
        desktopCollapsed = !sidebar.classList.contains('collapsed');
        sidebar.classList.toggle('collapsed', desktopCollapsed);
        if (mainContent) mainContent.classList.toggle('sidebar-collapsed', desktopCollapsed);
        try { localStorage.setItem(STORAGE_KEY, String(desktopCollapsed)); } catch (e) { /* private mode */ }
        updateToggleIcon();
    };

    const restoreDesktopState = () => {
        if (isMobile()) return;
        sidebar.classList.toggle('collapsed', desktopCollapsed);
        if (mainContent) mainContent.classList.toggle('sidebar-collapsed', desktopCollapsed);
        updateToggleIcon();
    };

    // ---- mobile ----------------------------------------------------------

    const openMobileSidebar = () => {
        if (!isMobile() || sidebar.classList.contains('active')) return;
        previousFocus = document.activeElement;
        sidebar.inert = false;
        sidebar.removeAttribute('aria-hidden');
        sidebar.setAttribute('role', 'dialog');
        sidebar.setAttribute('aria-modal', 'true');
        sidebar.classList.add('active');
        getBackdrop().classList.add('active');
        lockScroll();
        // Move focus before making the previously focused background inert.
        const firstControl = toggle || sidebar.querySelector('a[href], button, [tabindex="0"]');
        if (firstControl) firstControl.focus({ preventScroll: true });
        else sidebar.focus({ preventScroll: true });
        setBackgroundInert(true);
        updateToggleIcon();
    };

    const closeMobileSidebar = (restoreFocus = true) => {
        const wasOpen = sidebar.classList.contains('active');
        sidebar.classList.remove('active');
        if (backdrop) backdrop.classList.remove('active');
        setBackgroundInert(false);
        unlockScroll();
        sidebar.removeAttribute('role');
        sidebar.removeAttribute('aria-modal');
        if (wasOpen && restoreFocus) {
            const focusTarget = previousFocus && previousFocus.isConnected ? previousFocus : mobileBtn;
            if (focusTarget) focusTarget.focus({ preventScroll: true });
        }
        sidebar.inert = isMobile();
        if (isMobile()) sidebar.setAttribute('aria-hidden', 'true');
        else sidebar.removeAttribute('aria-hidden');
        updateToggleIcon();
    };

    // ---- icon swap -------------------------------------------------------

    const updateToggleIcon = () => {
        const isOpen = isMobile()
            ? sidebar.classList.contains('active')
            : !sidebar.classList.contains('collapsed');
        [toggle, mobileBtn].filter(Boolean).forEach((button) => {
            button.setAttribute('type', 'button');
            button.setAttribute('aria-controls', sidebar.id);
            button.setAttribute('aria-expanded', String(isOpen));
            const label = isMobile()
                ? (isOpen ? 'Close navigation menu' : 'Open navigation menu')
                : (isOpen ? 'Collapse navigation' : 'Expand navigation');
            button.setAttribute('aria-label', label);
            const icon = button.querySelector('i');
            if (icon) icon.className = isOpen ? 'fas fa-times' : 'fas fa-bars';
        });
    };

    // ---- event listeners -------------------------------------------------

    if (toggle) {
        toggle.addEventListener('click', () => {
            if (isMobile()) {
                sidebar.classList.contains('active')
                    ? closeMobileSidebar()
                    : openMobileSidebar();
            } else {
                toggleDesktop();
            }
        });
    }

    if (mobileBtn) {
        mobileBtn.addEventListener('click', () => {
            sidebar.classList.contains('active')
                ? closeMobileSidebar()
                : openMobileSidebar();
        });
    }

    // Close mobile sidebar on ESC
    document.addEventListener('keydown', (e) => {
        if (!isMobile() || !sidebar.classList.contains('active')) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            closeMobileSidebar();
        } else if (e.key === 'Tab') {
            const focusable = Array.from(sidebar.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
                .filter((element) => element.getClientRects().length && !element.closest('[inert]'));
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (!first) {
                e.preventDefault();
                sidebar.focus({ preventScroll: true });
            } else if (e.shiftKey && (document.activeElement === first || !sidebar.contains(document.activeElement))) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && (document.activeElement === last || !sidebar.contains(document.activeElement))) {
                e.preventDefault();
                first.focus();
            }
        }
    });

    // Close mobile sidebar when a nav link is clicked (event delegation)
    sidebar.addEventListener('click', (e) => {
        if (isMobile() && e.target.closest('a')) {
            closeMobileSidebar(false);
        }
    });

    // Clean up mobile state when resizing to desktop
    const syncViewport = () => {
        closeMobileSidebar(false);
        if (isMobile()) {
            sidebar.classList.remove('collapsed');
            if (mainContent) mainContent.classList.remove('sidebar-collapsed');
        } else {
            restoreDesktopState();
        }
        updateToggleIcon();
    };
    if (mobileViewport.addEventListener) mobileViewport.addEventListener('change', syncViewport);
    else mobileViewport.addListener(syncViewport);

    sidebar.addEventListener('sidebar:statechange', () => {
        desktopCollapsed = sidebar.classList.contains('collapsed');
        updateToggleIcon();
    });

    if (!sidebar.hasAttribute('aria-label')) sidebar.setAttribute('aria-label', 'Site navigation');
    sidebar.setAttribute('tabindex', '-1');
    syncViewport();
}

/* ==========================================================================
   2. Game Search + Category Filter
   ========================================================================== */

function initSearch() {
    const searchInput = document.getElementById('gameSearch');
    const searchStatus = document.getElementById('gameSearchStatus');
    const resetButton = document.getElementById('resetGameSearch');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const gameCards = document.querySelectorAll('.game-card');

    if (!searchInput && filterBtns.length === 0) return;
    if (gameCards.length === 0) return;

    let activeCategory = (Array.from(filterBtns).find((button) => button.classList.contains('active'))?.dataset.filter || 'all').toLowerCase();

    if (searchStatus) {
        searchStatus.setAttribute('role', 'status');
        searchStatus.setAttribute('aria-live', 'polite');
        searchStatus.setAttribute('aria-atomic', 'true');
    }

    const selectCategory = (category) => {
        activeCategory = category;
        filterBtns.forEach((button) => {
            const selected = (button.dataset.filter || 'all').toLowerCase() === category;
            button.classList.toggle('active', selected);
            button.setAttribute('aria-pressed', String(selected));
        });
    };

    /** Show / hide cards based on current search text and active category. */
    const normalizeQuery = value => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’‘']/g, '').replace(/[-–—_/]/g, ' ').replace(/\s+/g, ' ').trim();
    const filterCards = () => {
        const query = searchInput ? normalizeQuery(searchInput.value) : '';
        const terms = query.split(/\s+/).filter(Boolean);
        let visibleCount = 0;

        gameCards.forEach((card) => {
            const searchText = normalizeQuery(card.dataset.search || card.textContent);
            // Cards can belong to several categories, e.g. data-category="pc console"
            const categories = (card.dataset.category || '').toLowerCase().split(/\s+/);

            const matchesSearch = terms.every(term => searchText.includes(term));
            const matchesCategory = activeCategory === 'all' || categories.includes(activeCategory);

            const show = matchesSearch && matchesCategory;
            card.style.display = show ? '' : 'none';
            if (show) visibleCount++;
        });

        // Pages group cards into several grids under their own headings. Hide any
        // group that has nothing left in it so we don't leave a stranded heading.
        document.querySelectorAll('.games-grid').forEach((grid) => {
            const cards = grid.querySelectorAll('.game-card');
            if (cards.length === 0) return;

            const hasVisible = Array.from(cards).some((c) => c.style.display !== 'none');
            grid.style.display = hasVisible ? '' : 'none';

            const heading = grid.previousElementSibling;
            if (heading && heading.classList.contains('section-header')) {
                heading.style.display = hasVisible ? '' : 'none';
            }
            const group = grid.closest('[data-search-group]');
            if (group) group.hidden = !hasVisible;
        });

        // Toggle "no results" message
        const noResults = document.querySelector('.no-results');
        if (noResults) {
            noResults.style.display = visibleCount === 0 ? 'block' : 'none';
        }
        if (searchStatus) {
            const noun = searchStatus.dataset.resultNoun || 'game';
            searchStatus.textContent = `${visibleCount} ${noun}${visibleCount === 1 ? '' : 's'} shown`;
        }
    };

    if (searchInput) {
        searchInput.addEventListener('input', filterCards);
    }

    filterBtns.forEach((btn) => {
        btn.setAttribute('aria-pressed', String((btn.dataset.filter || 'all').toLowerCase() === activeCategory));
        btn.addEventListener('click', () => {
            selectCategory((btn.dataset.filter || 'all').toLowerCase());
            filterCards();
        });
    });
    const resetFilters = (focusSearch = true) => {
        if (searchInput) searchInput.value = '';
        selectCategory('all');
        filterCards();
        if (focusSearch && searchInput) searchInput.focus();
    };
    if (resetButton) resetButton.addEventListener('click', () => resetFilters());
    document.querySelectorAll('[data-search-reveal]').forEach((link) => {
        link.addEventListener('click', () => resetFilters(false));
    });
    filterCards();
}

/* ==========================================================================
   3. Hero Typing Animation
   ========================================================================== */

function initHeroAnimations() {
    const heroTitle = document.querySelector('.hero-title');
    if (!heroTitle || !heroTitle.hasAttribute('data-text')) return;

    const fullText = heroTitle.dataset.text || heroTitle.textContent;

    // Opted-in titles appear immediately on small screens or with reduced motion.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.matchMedia('(max-width: 1024px)').matches) {
        heroTitle.textContent = fullText;
        return;
    }

    // Clear current content and set up cursor
    heroTitle.textContent = '';
    const cursor = document.createElement('span');
    cursor.className = 'typing-cursor';
    cursor.textContent = '|';
    heroTitle.appendChild(cursor);

    let index = 0;
    const SPEED = 80;   // ms per character
    const DELAY = 500;  // initial delay before typing starts

    const typeChar = () => {
        if (index < fullText.length) {
            // Insert character before the cursor element
            heroTitle.insertBefore(
                document.createTextNode(fullText.charAt(index)),
                cursor
            );
            index++;
            setTimeout(typeChar, SPEED);
        }
    };

    setTimeout(typeChar, DELAY);
}

/* ==========================================================================
   4. Stats Counter Animation
   ========================================================================== */

function initStatsCounters() {
    const statElements = document.querySelectorAll('.stat h3');
    if (statElements.length === 0) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animated = false;

    /**
     * Resolve the target number and suffix for a stat element.
     *
     * Priority:
     *   1. Explicit data-target / data-suffix attributes (e.g. <h3 data-target="70" data-suffix="K+">0</h3>)
     *   2. A numeric text value like "70K+" or "1,000+"
     *   3. Non-numeric text ("Enhanced", "JTAG", ...) -> not animatable, left untouched.
     */
    const resolveStat = (el) => {
        if (el.dataset.target != null) {
            return {
                value: parseFloat(String(el.dataset.target).replace(/,/g, '')) || 0,
                suffix: el.dataset.suffix || ''
            };
        }
        const match = el.textContent.trim().match(/^([\d,.]+)\s*(.*)$/);
        if (!match) return null; // purely textual stat — don't animate or it becomes "0Enhanced"
        return {
            value: parseFloat(match[1].replace(/,/g, '')),
            suffix: match[2]
        };
    };

    const animateCounters = () => {
        if (animated) return;
        animated = true;

        const duration = 2000; // ms

        statElements.forEach((el) => {
            const stat = resolveStat(el);
            if (!stat) return; // leave non-numeric stats exactly as authored

            const { value: target, suffix } = stat;

            // Honor reduced-motion: jump straight to the final value.
            if (reduceMotion) {
                el.textContent = target + suffix;
                return;
            }

            const start = performance.now();

            const step = (now) => {
                const elapsed = now - start;
                const progress = Math.min(elapsed / duration, 1);
                // ease-out quad for a nice deceleration
                const eased = 1 - (1 - progress) * (1 - progress);
                const current = Math.floor(eased * target);
                el.textContent = current + suffix;

                if (progress < 1) {
                    requestAnimationFrame(step);
                } else {
                    el.textContent = target + suffix;
                }
            };

            requestAnimationFrame(step);
        });
    };

    // Observe a parent section so counters fire when the stats area scrolls in
    const section = statElements[0].closest('section') || statElements[0].parentElement;
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    animateCounters();
                    observer.disconnect();
                }
            });
        },
        { threshold: 0.1 }
    );
    observer.observe(section);
}

/* ==========================================================================
   5. Scroll Effects (Fade-in + Back to Top)
   ========================================================================== */

function initScrollEffects() {
    // ---- Fade-in on scroll -----------------------------------------------

    const fadeEls = window.WWB_HOST_CONSOLE === true || window.WhatsiteConsoleLite && window.WhatsiteConsoleLite.enabled ? [] : document.querySelectorAll('.fade-in');

    if (fadeEls.length > 0) {
        const fadeObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;

                    const el = entry.target;

                    // If the element uses staggered children, reveal them sequentially
                    if (el.classList.contains('fade-in-stagger')) {
                        Array.from(el.children).forEach((child, i) => {
                            child.style.transitionDelay = `${i * 0.1}s`;
                            child.classList.add('visible');
                        });
                    }

                    el.classList.add('visible');
                    fadeObserver.unobserve(el);
                });
            },
            { threshold: 0.1 }
        );

        fadeEls.forEach((el) => fadeObserver.observe(el));
    }

    // ---- Back to Top button -----------------------------------------------

    const backToTop = document.getElementById('backToTop');
    if (!backToTop) return;

    const updateBackToTop = () => {
        if (window.scrollY > 300) {
            backToTop.classList.add('visible');
        } else {
            backToTop.classList.remove('visible');
        }
    };
    window.addEventListener('scroll', updateBackToTop, { passive: true });
    updateBackToTop();

    backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: window.WWB_HOST_CONSOLE === true || window.WhatsiteConsoleLite && window.WhatsiteConsoleLite.enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
}

/* ==========================================================================
   6. FAQ Accordion
   ========================================================================== */

function initFaqAccordion() {
    const faqQuestions = document.querySelectorAll('.faq-question');
    if (faqQuestions.length === 0) return;

    // Let long answers reflow when the phone rotates or the language changes.
    // Fixed pixel heights and transitionend-dependent cleanup can cut off content.
    const setExpanded = (item, expanded) => {
        item.classList.toggle('active', expanded);
        const question = item.querySelector('.faq-question');
        const answer = item.querySelector('.faq-answer');
        if (question) question.setAttribute('aria-expanded', String(expanded));
        if (answer) {
            answer.hidden = !expanded;
            answer.style.height = expanded ? 'auto' : '';
            answer.style.maxHeight = expanded ? 'none' : '';
        }
    };

    faqQuestions.forEach((question, index) => {
        const item = question.closest('.faq-item');
        if (!item) return;
        const answer = item.querySelector('.faq-answer');
        if (question.tagName !== 'BUTTON') {
            question.setAttribute('role', 'button');
            question.setAttribute('tabindex', '0');
            question.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    question.click();
                }
            });
        }
        if (answer) {
            if (!answer.id) answer.id = `faq-answer-${index + 1}`;
            question.setAttribute('aria-controls', answer.id);
        }
        setExpanded(item, item.classList.contains('active'));
        question.addEventListener('click', () => {
            const parentItem = question.closest('.faq-item');
            if (!parentItem) return;

            const isActive = parentItem.classList.contains('active');

            // Close all other FAQ items (only one open at a time)
            document.querySelectorAll('.faq-item.active').forEach((item) => {
                if (item !== parentItem) {
                    setExpanded(item, false);
                }
            });

            // Toggle the clicked item
            setExpanded(parentItem, !isActive);
        });
    });
}

/* ==========================================================================
   7. FAQ Search
   ========================================================================== */

function initFaqSearch() {
    const faqSearch = document.getElementById('faqSearch');
    if (!faqSearch) return;

    const faqItems = document.querySelectorAll('.faq-item');
    if (faqItems.length === 0) return;

    // Create a "no results" message if one doesn't already exist
    let noResults = document.querySelector('.faq-no-results');
    if (!noResults) {
        noResults = document.createElement('p');
        noResults.className = 'faq-no-results';
        noResults.setAttribute('role', 'status');
        noResults.textContent = 'No matching questions found.';
        noResults.style.display = 'none';
        // Keep this outside categories, which may all be hidden by a search.
        const container = faqSearch.closest('.container') || faqItems[0].parentElement;
        if (container) container.appendChild(noResults);
    }

    faqSearch.addEventListener('input', () => {
        const query = faqSearch.value.toLowerCase().trim();
        let visibleCount = 0;

        faqItems.forEach((item) => {
            const questionEl = item.querySelector('.faq-question');
            const answerEl = item.querySelector('.faq-answer');
            const questionText = questionEl ? questionEl.textContent.toLowerCase() : '';
            const answerText = answerEl ? answerEl.textContent.toLowerCase() : '';

            const matches = !query || questionText.includes(query) || answerText.includes(query);
            item.style.display = matches ? '' : 'none';
            if (matches) visibleCount++;
        });

        document.querySelectorAll('.faq-category').forEach((category) => {
            const items = category.querySelectorAll('.faq-item');
            if (items.length) category.style.display = Array.from(items).some((item) => item.style.display !== 'none') ? '' : 'none';
        });

        noResults.style.display = visibleCount === 0 ? 'block' : 'none';
    });
}

/* ==========================================================================
   8. Service Worker Registration
   ========================================================================== */

function initServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
        .register('/service-worker.js')
        .then((reg) => console.log('Service worker registered:', reg.scope))
        .catch((err) => console.log('Service worker registration failed:', err));
}

/* ==========================================================================
   9. Smooth Scroll for Anchor Links
   ========================================================================== */

function initSmoothScroll() {
    // Use event delegation on the document so dynamically-added links work too
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href^="#"]');
        if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || link.hasAttribute('download') || link.hasAttribute('data-guide-open')) return;

        const targetId = link.getAttribute('href');
        if (!targetId || targetId === '#') return;

        let target;
        try { target = document.getElementById(decodeURIComponent(targetId.slice(1))); } catch (error) { return; }
        if (!target) return;

        e.preventDefault();
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        if (!target.hasAttribute('tabindex')) {
            target.setAttribute('tabindex', '-1');
            target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
        }
        target.focus({ preventScroll: true });
        if (window.location.hash !== targetId) history.pushState(null, '', targetId);
    });
}

/* ==========================================================================
   10. Blog Category Filter
   ========================================================================== */

function initBlogFilter() {
    const filterBtns = document.querySelectorAll('.blog-filter-btn');
    const blogCards = document.querySelectorAll('.blog-card');

    if (filterBtns.length === 0 || blogCards.length === 0) return;

    filterBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            // Update active button
            filterBtns.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');

            const category = (btn.dataset.category || 'all').toLowerCase();

            blogCards.forEach((card) => {
                const categories = (card.dataset.category || '').toLowerCase().split(/\s+/);
                card.style.display =
                    (category === 'all' || categories.includes(category)) ? '' : 'none';
            });
        });
    });
}

/* ==========================================================================
   Sidebar Groups
   ========================================================================== */

function initSidebarGroups() {
    const sidebar = document.getElementById('sidebar');
    const groups = document.querySelectorAll('.nav-group');
    if (groups.length === 0) return;

    // Open whichever group holds the current page, so you can see where you are.
    const syncGroup = (group, index) => {
        const button = group.querySelector('.nav-group-toggle');
        const sublist = group.querySelector('.nav-sublist');
        const open = group.classList.contains('open');
        if (button) {
            button.setAttribute('aria-expanded', String(open));
            if (sublist) {
                if (!sublist.id) sublist.id = `navigation-group-${index + 1}`;
                button.setAttribute('aria-controls', sublist.id);
            }
        }
        if (sublist) sublist.inert = !open;
    };

    groups.forEach((group, index) => {
        if (group.querySelector('.nav-link.active')) {
            group.classList.add('open');
        }
        syncGroup(group, index);
    });

    document.querySelectorAll('.nav-group-toggle').forEach((toggle, index) => {
        toggle.addEventListener('click', () => {
            const group = toggle.closest('.nav-group');
            if (!group) return;

            // On the collapsed rail there is no room for a sublist, so open the
            // sidebar first rather than expanding into nothing.
            if (sidebar && sidebar.classList.contains('collapsed')) {
                sidebar.classList.remove('collapsed');
                const main = document.getElementById('main-content');
                if (main) main.classList.remove('sidebar-collapsed');
                try { localStorage.setItem('sidebarCollapsed', 'false'); } catch (e) { /* private mode */ }
                group.classList.add('open');
                syncGroup(group, index);
                sidebar.dispatchEvent(new Event('sidebar:statechange'));
                return;
            }

            group.classList.toggle('open');
            syncGroup(group, index);
        });
    });
}
