import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMsg = 'Erro ao processar requisição';

      if (
        error.error &&
        typeof error.error === 'object' &&
        typeof error.error.error === 'string'
      ) {
        errorMsg = error.error.error;
      }
      //   swalService.open('error', 'Erro', capitalizeFirstLetter(errorMsg));
      return throwError(() => error);
    }),
  );
};
