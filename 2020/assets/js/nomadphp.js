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

                var data = {
                    "ticket[1][fname]" : $('input#first-name').val(),
                    "ticket[1][lname]" : $('input#last-name').val(),
                    "ticket[1][email]" : $('input#email').val(),
                    "validate" : true
                }

                $.ajax({
                  method: "POST",
                  url: "https://dmtphp.io/widgets/ticket.php?event=darkmira&bgcolor=151f20&color=fff",
                  data: data
                }).done(function() {
                   $('#alert-success-sign-up').removeClass('d-none');
                   $('#form-sign-up').addClass('d-none');
                }).fail(function() {
                   $('#alert-error-sign-up').removeClass('d-none');
                   $('#form-sign-up').addClass('d-none');
                })

            }, false);
        });
    }, false);
})();
