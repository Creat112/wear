(function () {
    const footerUrl = 'footer.html';

    function getFooterTarget() {
        const existingTarget = document.getElementById('footer-placeholder');
        if (existingTarget) {
            return existingTarget;
        }

        const target = document.createElement('div');
        target.id = 'footer-placeholder';
        document.body.appendChild(target);
        return target;
    }

    async function loadFooter() {
        const target = getFooterTarget();
        const response = await fetch(footerUrl);
        if (!response.ok) {
            throw new Error(`Footer failed to load: ${response.status}`);
        }
        target.innerHTML = await response.text();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            loadFooter().catch(error => console.error(error));
        });
    } else {
        loadFooter().catch(error => console.error(error));
    }
}());
