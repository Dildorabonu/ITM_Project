namespace Application.Services;

/// <summary>
/// Access token stateless — imzosi va muddati tekshiriladi, xolos. Seans tugatilganda
/// esa u darhol ishlamay qolishi kerak, shuning uchun har so'rovda token qaysi seansga
/// (token oilasiga) tegishli ekani shu yerdan tekshiriladi.
/// </summary>
public interface ISessionGuard
{
    Task<bool> IsActiveAsync(Guid familyId, CancellationToken ct = default);

    /// <summary>Seans bekor qilinganini keshga darhol yozadi — DB'ni kutib turmasdan.</summary>
    void MarkRevoked(Guid familyId);
}
