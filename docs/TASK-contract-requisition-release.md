# TASK: Shartnoma talabnomasini "berib yuborish" (release) ishlamaydi

**Holat:** Ochiq (open)
**Yaratilgan:** 2026-06-20
**Tegishli commit:** `3e1414d9` (stock movement ledger and requisition receiving flow)

## Muammo

Muzlatilgan mahsulotlarni "Berib yuborish" (release) qilishda **Shartnoma (Contract)
bo'yicha** talabnomalarda quyidagi xatolik chiqadi:

> Xatolik: Talabnoma bo'limga bog'lanmagan — qaysi bo'lim omboriga tushishi noma'lum.

Toast title "MAHSULOTLARNI BERIB YUBORISH" modalida tasdiqlangandan keyin paydo bo'ladi.

## Sabab (root cause)

`ReleaseAsync` talabnomada yagona maqsadli bo'lim (`DepartmentId`) borligini talab qiladi:

- [`Back/src/Application/Services/Impl/RequisitionService.cs:484`](../Back/src/Application/Services/Impl/RequisitionService.cs#L484)
  ```csharp
  if (r.DepartmentId is null)
      return ApiResult<bool>.Failure(["Talabnoma bo'limga bog'lanmagan — qaysi bo'lim omboriga tushishi noma'lum."]);
  var targetDeptId = r.DepartmentId.Value;
  ```

Lekin `DepartmentId` faqat **Individual** talabnomalarda to'ldiriladi:

- Entity izohi: [`Back/src/Core/Entities/Requisition.cs:13-16`](../Back/src/Core/Entities/Requisition.cs#L13-L16)
  — `ContractId` "Shartnoma bo'yicha bo'lsa", `DepartmentId` "Individual bo'lsa".
- Yaratishda validatsiya faqat Individual uchun majburiy:
  [`RequisitionService.cs:146`](../Back/src/Application/Services/Impl/RequisitionService.cs#L146).
- Frontend create formasi shartnoma turida `departmentId` umuman yubormaydi:
  [`client/app/(documents)/requisitions/print/page.tsx:583-584`](<../client/app/(documents)/requisitions/print/page.tsx#L583-L584>)
  ```ts
  contractId:   type === RequisitionType.Contract   ? contractId   : undefined,
  departmentId: type === RequisitionType.Individual ? departmentId : undefined,
  ```
- Bo'linganda (`BuildChildren`) null parent'dan child'ga ko'chadi:
  [`RequisitionService.cs:359,384`](../Back/src/Application/Services/Impl/RequisitionService.cs#L359) (`DepartmentId = parent.DepartmentId`).

Shartnoma bir nechta bo'limga taqsimlanishi mumkin (`ContractDepartment` — many-to-many,
[`Back/src/Core/Entities/ContractDepartment.cs`](../Back/src/Core/Entities/ContractDepartment.cs)),
shuning uchun shartnoma talabnomasi uchun "yagona maqsadli bo'lim" yo'q → release yiqiladi.

## Tanlangan yechim

**Berib yuborishda omborchi maqsadli bo'limni qo'lda tanlaydi.**
(Eng moslashuvchan — bir shartnoma ko'p bo'limga taalluqli bo'lganda ham ishlaydi.)

### Bajariladigan ishlar

**Backend:**
1. `IRequisitionService.ReleaseAsync` imzosiga `targetDepartmentId` qo'shish (yoki yangi
   `RequisitionReleaseDto { Guid? TargetDepartmentId }`).
   - [`Back/src/Application/Services/IRequisitionService.cs`](../Back/src/Application/Services/IRequisitionService.cs)
2. `ReleaseAsync` logikasi ([`RequisitionService.cs:475-485`](../Back/src/Application/Services/Impl/RequisitionService.cs#L475-L485)):
   - `r.DepartmentId` bor bo'lsa (Individual) — o'shani ishlatish (eski xatti-harakat).
   - Yo'q bo'lsa (Contract) — DTO dagi `targetDepartmentId` ni ishlatish; u ham bo'lmasa
     hozirgi xatolikni qaytarish.
   - Maqsadli bo'lim mavjudligini tekshirish allaqachon bor ([satr 489](../Back/src/Application/Services/Impl/RequisitionService.cs#L489)).
3. Controller'ni yangilash:
   [`Back/src/API/Controllers/RequisitionController.cs`](../Back/src/API/Controllers/RequisitionController.cs) (release endpoint body qabul qilsin).
4. Testlarni yangilash/qo'shish:
   [`Back/test/Application.Tests/Services/RequisitionServiceTests.cs:936`](../Back/test/Application.Tests/Services/RequisitionServiceTests.cs#L936)
   — null branch hali ham xato qaytarishini, va targetDepartmentId berilganda muvaffaqiyatli bo'lishini tekshirish.

**Frontend:**
5. `requisitionService.release` ga `targetDepartmentId` parametri qo'shish:
   [`client/lib/userService.ts`](../client/lib/userService.ts) (`release` funksiyasi ~1388-satr atrofida).
6. "Berib yuborish" modaliga bo'lim tanlash (`CheckSelect`/select) qo'shish — faqat
   `targetDepartmentName == null` (shartnoma) bo'lganda majburiy ko'rsatiladi:
   [`client/app/(warehouse)/warehouse-inventory/_components/FrozenProductsView.tsx`](<../client/app/(warehouse)/warehouse-inventory/_components/FrozenProductsView.tsx>)
   - `releaseConfirm` state'iga tanlangan bo'lim qo'shiladi.
   - `handleRelease` ([satr 83-97](<../client/app/(warehouse)/warehouse-inventory/_components/FrozenProductsView.tsx#L83-L97>)) tanlangan bo'limni yuboradi.
   - Bo'limlar ro'yxati: ideal holda tanlovni shartnomaning `ContractDepartment` lari bilan cheklash;
     minimal holda barcha aktiv bo'limlar.

### Edge-case'lar
- Individual talabnoma: avvalgidek `DepartmentId` ishlatiladi, modal bo'lim so'ramaydi.
- Bo'lim tanlanmasa — backend xato qaytaradi, frontend submitни bloklaydi.
- `IX_Products_Name_DepartmentId(_Unit)` unikal cheklov upsert logikasi tanlangan bo'lim
  bo'yicha ishlashini tekshirish ([RequisitionService.cs:701-730](../Back/src/Application/Services/Impl/RequisitionService.cs#L701-L730)).

## Tekshirish (verify)
- Shartnoma turidagi talabnomani yaratish → ombor tekshiruvi → direktor tasdiqi →
  "Muzlatilgan mahsulotlar" da bo'lim tanlab "Berib yuborish" → tanlangan bo'lim omboriga
  mahsulot tushishi va korxona omborxonasidan ayrilishini tekshirish.
- Individual talabnoma uchun regress yo'qligini tekshirish.
