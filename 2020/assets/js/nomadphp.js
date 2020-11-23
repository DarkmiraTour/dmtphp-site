(function () {
    'use strict';
    window.addEventListener('load', function () {
        let forms = document.getElementsByClassName('needs-validation');

        let validation = Array.prototype.filter.call(forms, function (form) {
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                event.stopPropagation();
                if (false === form.checkValidity()) {
                    form.classList.add('was-validated');
                    form.reportValidity();
                    return;
                }
                form.classList.remove('was-validated');
                const formData = new FormData(form);

                fetch('https://dmtphp.io/widgets/ticket.php?event=darkmira&bgcolor=151f20&color=fff', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json, application/xml, text/plain, text/html, *.*',
                        'Content-Type': 'multipart/form-data',
                    },
                    body: formData,
                })
                .then(data => {
                    console.log('Success:', data);
                })
                .catch((error) => {
                    console.log('Error:', error);
                });

            }, false);
        });
    }, false);
})();
