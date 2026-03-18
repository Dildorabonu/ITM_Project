namespace Application.DTOs;

public class ApiResult<T>
{
    private ApiResult() { }

    private ApiResult(bool succeeded, int statusCode, T? result, IEnumerable<string> errors)
    {
        Succeeded = succeeded;
        StatusCode = statusCode;
        Result = result;
        Errors = errors;
    }

    public bool Succeeded { get; set; }

    public int StatusCode { get; set; }

    public T? Result { get; set; }

    public IEnumerable<string> Errors { get; set; } = [];

    public static ApiResult<T> Success(T? result = default, int statusCode = 200)
    {
        return new ApiResult<T>(true, statusCode, result, []);
    }

    public static ApiResult<T> Failure(IEnumerable<string> errors, int statusCode = 400)
    {
        return new ApiResult<T>(false, statusCode, default, errors);
    }
}
