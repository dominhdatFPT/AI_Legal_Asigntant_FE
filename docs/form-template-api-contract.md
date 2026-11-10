# Hợp đồng API: Mẫu đơn dùng chung (Procedure service)

Tài liệu cho người làm BE. FE đã xong trên nhánh `features/ThemMauDonChung_Kien` và đang chạy bằng mock trong bộ nhớ.
Khi BE xong: đặt `USE_MOCK = false` trong `AI_Legal/public/form-template-service.js` (hoặc thêm `?api=real` vào URL trang để thử).

| Phần FE | File |
|---|---|
| Thư viện thẻ có sẵn + kiểm tra theo kiểu | `AI_Legal/public/form-blocks.js` (dùng quy tắc của `field-rules.js`) |
| Gọi API (mock / thật) | `AI_Legal/public/form-template-service.js` |
| Hiển thị form, tự điền, bản in | `AI_Legal/public/form-renderer.js` |
| Admin: danh sách + khung "Thêm mẫu đơn" trên `/land-forms` (đất đai) và `/business-form-templates` (hộ kinh doanh, doanh nghiệp) | `AI_Legal/public/form-templates-admin.js` |

## 1. Quy ước chung

- Đi qua Gateway với tiền tố đang dùng của Procedure service: `/api/procedures/...` (giống `/api/procedures/domains/...`, `/api/procedures/form-schema/...`).
  Không trùng với `/api/procedures/templates` (kho mẫu tham khảo đã có).
- Xác thực bằng cookie phiên như các API khác (`credentials: 'include'`). API `admin/...` chỉ cho role `admin`.
- Bọc kết quả như hiện tại: thành công `{ "data": ... }`, lỗi `{ "error": { "code", "message", "details"? } }`.
  `message` hiện thẳng lên giao diện nên viết tiếng Việt. `details` (khi 422) là `[{ "field", "message" }]`.
- `DELETE` có thể trả `204` không có body.

## 2. Bảng endpoint

| Method | Path | Ai | Mô tả | Thành công |
|---|---|---|---|---|
| GET | `/api/procedures/admin/form-templates?domain=&status=&include_deleted=` | admin | Danh sách mọi version, mọi trạng thái. Mặc định không trả bản đã xóa; `include_deleted=true` thì trả cả bản đã xóa. | 200 `{ items, total }` |
| GET | `/api/procedures/admin/form-templates/{id}` | admin | Chi tiết 1 version (kể cả nháp). | 200 mẫu |
| POST | `/api/procedures/admin/form-templates` | admin | Tạo mẫu mới. Body = `content` (mục 4). Tạo nhóm mới, `version = 1`, `status = draft`. | 201 mẫu |
| PUT | `/api/procedures/admin/form-templates/{id}` | admin | Sửa, body = `content`. Chỉ khi `status = draft`. Cập nhật luôn `name`, `domain`, `procedure_id` theo content. | 200 mẫu |
| POST | `/api/procedures/admin/form-templates/{id}/publish` | admin | Xuất bản bản `draft` (hoặc bản `hidden`). Bản `published`/`hidden` khác cùng `template_group_id` → `archived`. Phải qua kiểm tra đầy đủ mục 5. | 200 mẫu |
| POST | `/api/procedures/admin/form-templates/{id}/hide` | admin | Ẩn khỏi công dân. Chỉ khi `published` → `hidden`. | 200 mẫu |
| POST | `/api/procedures/admin/form-templates/{id}/new-version` | admin | Tạo bản `draft` mới cùng nhóm, chép `content` từ bản `{id}`, `version = max(version của nhóm) + 1`. Nếu nhóm đã có bản nháp (chưa xóa) thì trả lại bản nháp đó, không tạo thêm. | 201 (mới) / 200 (đã có) mẫu |
| DELETE | `/api/procedures/admin/form-templates/{id}` | admin | Xóa mềm: đặt `deleted_at`. | 204 |
| POST | `/api/procedures/admin/form-templates/{id}/restore` | admin | Khôi phục: `deleted_at = null`, giữ nguyên `status`. | 200 mẫu |
| GET | `/api/procedures/form-templates?domain=&procedure_id=` | công dân | Chỉ `published`, chưa xóa, bản mới nhất mỗi nhóm. | 200 `{ items, total }` |
| GET | `/api/procedures/form-templates/{id}` | công dân | Chi tiết mẫu `published` chưa xóa; khác → 404. | 200 mẫu |

FE gọi ở: `form-template-service.js` (`real.listAdmin`, `getAdmin`, `create`, `update`, `publish`, `hide`, `newVersion`, `remove`, `restore`, `listPublished`, `getPublished`).

### Trạng thái và phiên bản

```
draft ──publish──▶ published ──hide──▶ hidden ──publish──▶ published
                       │
   new-version (bản nháp vN+1, cùng nhóm) ──publish──▶ published (vN+1); bản published/hidden cũ ──▶ archived
```

- Sửa mẫu đang `published` **không ghi đè**: FE gọi `new-version` rồi sửa bản nháp đó bằng `PUT`.
- Mỗi nhóm có tối đa 1 bản `published` (hoặc `hidden`) và tối đa 1 bản `draft` chưa xóa.
- `archived` chỉ để xem lại. Admin bấm "Sửa" trên bản `archived` cũng đi qua `new-version`.
- `deleted_at` độc lập với `status`. Bản đã xóa không hiện cho công dân.

### Mẫu trả về (mỗi version)

```json
{
  "id": "8f0c7a2e-3b1d-4c55-9f0e-2a6d8c1b4e77",
  "template_group_id": "1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d",
  "version": 2,
  "status": "draft",
  "name": "Hợp đồng ủy quyền",
  "domain": "dat_dai",
  "procedure_id": "p-dd-001",
  "content": { "...": "JSON mục 4" },
  "created_at": "2026-10-26T08:40:00Z",
  "updated_at": "2026-10-26T08:45:12Z",
  "deleted_at": null
}
```

`status`: `draft | published | hidden | archived`. `domain`: `dat_dai | ho_kinh_doanh | doanh_nghiep`.
`id`, `template_group_id`, `version`, `status`, các mốc thời gian là cột riêng, **không** nằm trong `content`.
`name`, `domain`, `procedure_id` lấy lại từ `content` để lọc/đánh chỉ mục.

### Ví dụ

`POST /api/procedures/admin/form-templates` với body là content ở mục 4 → `201`:

```json
{ "data": { "id": "8f0c…", "template_group_id": "1b2c…", "version": 1, "status": "draft", "name": "Hợp đồng ủy quyền",
  "domain": "dat_dai", "procedure_id": null, "content": { "schema_version": 1, "...": "..." },
  "created_at": "2026-10-26T08:40:00Z", "updated_at": "2026-10-26T08:40:00Z", "deleted_at": null } }
```

`GET /api/procedures/form-templates?domain=dat_dai` → `200`:

```json
{ "data": { "items": [ { "id": "8f0c…", "version": 2, "status": "published", "name": "Hợp đồng ủy quyền", "...": "..." } ], "total": 1 } }
```

`PUT` bản đang `published` → `409`:

```json
{ "error": { "code": "TEMPLATE_NOT_DRAFT", "message": "Chỉ sửa được bản nháp. Hãy tạo phiên bản mới." } }
```

### Mã lỗi mong đợi

| HTTP | `code` | Khi nào |
|---|---|---|
| 401 | (theo User service) | Chưa đăng nhập / hết phiên. FE tự refresh rồi chuyển `/login`. |
| 403 | `FORBIDDEN` | Không phải admin mà gọi `admin/...`. |
| 404 | `TEMPLATE_NOT_FOUND` | Không có `{id}`, hoặc đã xóa (trừ `restore`), hoặc công dân xem bản không `published`. |
| 409 | `TEMPLATE_NOT_DRAFT` | `PUT` vào bản không phải `draft`. |
| 409 | `INVALID_STATUS` | `publish` bản không phải `draft`/`hidden`; `hide` bản không phải `published`. |
| 422 | `VALIDATION_ERROR` | `content` sai schema hoặc sai quy tắc mục 5; `details: [{ field, message }]`, `field` dạng `sections[1].blocks[0].fields[0].label`. |

## 3. JSON Schema của `content`

`content` lưu **bản chụp đầy đủ các trường** (không chỉ `block_key`), nên sửa thư viện thẻ sau này không làm lệch mẫu cũ. BE lưu nguyên vào cột `jsonb`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "form-template-content.v1",
  "type": "object",
  "required": ["schema_version", "name", "domain", "sections"],
  "additionalProperties": false,
  "properties": {
    "schema_version": { "const": 1 },
    "name": { "type": "string", "minLength": 1, "maxLength": 255 },
    "code": { "type": "string", "maxLength": 50, "description": "Mã mẫu, vd 09/ĐK. Rỗng = không có mã." },
    "domain": { "enum": ["dat_dai", "ho_kinh_doanh", "doanh_nghiep"] },
    "procedure_id": { "type": ["string", "null"], "description": "id thủ tục từ GET /api/procedures/domains/all/names" },
    "sections": {
      "type": "array", "minItems": 1,
      "items": {
        "type": "object", "required": ["id", "title", "order", "blocks"], "additionalProperties": false,
        "properties": {
          "id": { "type": "string", "pattern": "^sec_[0-9]+$" },
          "title": { "type": "string", "minLength": 1, "maxLength": 255 },
          "order": { "type": "integer", "minimum": 1 },
          "blocks": {
            "type": "array", "minItems": 1,
            "items": {
              "type": "object", "required": ["instance_id", "block_key", "order", "fields"], "additionalProperties": false,
              "properties": {
                "instance_id": { "type": "string", "pattern": "^[a-z_]+_[0-9]+$", "description": "<block_key>_<n>, trường tự do: free_<n>; duy nhất trong mẫu" },
                "block_key": { "enum": ["personal_info", "dob", "cccd", "address", "phone", "email", "tax_code", "organization", "business_lines", "land_parcel", "receiving_agency", "free_field"] },
                "order": { "type": "integer", "minimum": 1 },
                "fields": {
                  "type": "array", "minItems": 1,
                  "items": {
                    "type": "object", "required": ["key", "label", "type", "required"], "additionalProperties": false,
                    "properties": {
                      "key": { "type": "string", "pattern": "^[a-z][a-z0-9_]*$" },
                      "label": { "type": "string", "minLength": 1 },
                      "type": { "enum": ["text", "textarea", "number", "date", "past_date", "dob", "issue_date", "cccd", "phone", "email", "select"] },
                      "required": { "type": "boolean" },
                      "autofill": { "type": "string", "pattern": "^profile\\.[a-z_]+$" },
                      "options": { "type": "array", "items": { "type": "string" }, "description": "chỉ khi type = select" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

Ví dụ thật (FE gửi khi bấm Lưu nháp, rút gọn; bản đầy đủ do test sinh ra ở `screenshots-mau-don/mau-json-gui-be.json`):

```json
{
  "schema_version": 1,
  "name": "Hợp đồng thuê nhà ở",
  "code": "HĐ-TN/01",
  "domain": "dat_dai",
  "procedure_id": "p-dd-001",
  "sections": [
    { "id": "sec_1", "title": "I. Bên cho thuê", "order": 1, "blocks": [
      { "instance_id": "personal_info_1", "block_key": "personal_info", "order": 1, "fields": [
        { "key": "full_name", "label": "Họ và tên", "type": "text", "required": true, "autofill": "profile.full_name" },
        { "key": "dob", "label": "Ngày tháng năm sinh", "type": "dob", "required": true, "autofill": "profile.dob" },
        { "key": "cccd_number", "label": "Số CCCD", "type": "cccd", "required": true, "autofill": "profile.cccd_number" },
        { "key": "cccd_issue_date", "label": "Ngày cấp CCCD", "type": "issue_date", "required": true, "autofill": "profile.cccd_issue_date" },
        { "key": "cccd_issue_place", "label": "Nơi cấp", "type": "text", "required": true, "autofill": "profile.cccd_issue_place" },
        { "key": "permanent_address", "label": "Nơi đăng ký thường trú", "type": "textarea", "required": true, "autofill": "profile.permanent_address" }
      ] },
      { "instance_id": "phone_1", "block_key": "phone", "order": 2, "fields": [
        { "key": "phone", "label": "Số điện thoại liên hệ", "type": "phone", "required": true, "autofill": "profile.phone" }
      ] }
    ] },
    { "id": "sec_2", "title": "II. Bên thuê", "order": 2, "blocks": [
      { "instance_id": "personal_info_2", "block_key": "personal_info", "order": 1, "fields": [ "… như personal_info_1 …" ] },
      { "instance_id": "free_1", "block_key": "free_field", "order": 2, "fields": [
        { "key": "value", "label": "Giá thuê mỗi tháng (đồng)", "type": "number", "required": false }
      ] }
    ] }
  ]
}
```

Dữ liệu công dân điền dùng khóa `<instance_id>.<key>`, vd `personal_info_2.full_name`. Hiện tại dữ liệu này **không gửi xuống BE**, chỉ dùng để tạo file PDF trên trình duyệt.

## 4. Thư viện thẻ có sẵn (`form-blocks.js`)

Nhãn cố định, admin không đổi nhãn và không cấu hình kiểm tra. Riêng "Trường tự do": admin nhập **tiêu đề ô (bắt buộc)** và chọn kiểu (chữ ngắn / đoạn dài / ngày / số), không cấu hình gì khác.

| block_key | Tên | Trường (key · type · bắt buộc) |
|---|---|---|
| `personal_info` | Thông tin cá nhân | full_name · text · ✓; dob · dob · ✓; cccd_number · cccd · ✓; cccd_issue_date · issue_date · ✓; cccd_issue_place · text · ✓; permanent_address · textarea · ✓ |
| `dob` | Ngày sinh | dob · dob · ✓ |
| `cccd` | CCCD | cccd_number · cccd · ✓; cccd_issue_date · issue_date · ✓; cccd_issue_place · text · ✓ |
| `address` | Địa chỉ | permanent_address · textarea · ✓; current_address · textarea |
| `phone` | Số điện thoại | phone · phone · ✓ |
| `email` | Email | email · email |
| `tax_code` | Mã số thuế | tax_code · text |
| `organization` | Thông tin tổ chức/doanh nghiệp | org_name · text · ✓; org_name_en · text; org_code · text; headquarters_address · textarea · ✓; headquarters_phone · phone · ✓; headquarters_email · email |
| `business_lines` | Ngành nghề và vốn kinh doanh | main_business_lines · textarea · ✓; capital · number · ✓; total_employees · number |
| `land_parcel` | Thông tin thửa đất | plot_number · text · ✓; map_sheet_number · text · ✓; land_address · textarea · ✓; land_area · number · ✓; land_use_purpose · select · ✓ (7 lựa chọn như BE); certificate_number · text; certificate_issue_date · past_date |
| `receiving_agency` | Cơ quan tiếp nhận | receiving_agency · text · ✓ |
| `free_field` | Trường tự do | value · text/textarea/date/number · không bắt buộc; label = tiêu đề admin nhập |

## 5. Kiểu trường và quy tắc kiểm tra

BE phải kiểm tra lại giống FE. Quy tắc gốc ở `AI_Legal/public/field-rules.js` (`checkField`), ánh xạ kiểu → quy tắc ở `form-blocks.js` (`TYPE_RULES`).

### 5.1. Kiểm tra giá trị (khi sau này có API nhận dữ liệu công dân điền)

Mọi giá trị được `trim()` trước. Ô `required` rỗng → "Vui lòng nhập thông tin này.". Ô không bắt buộc để trống thì bỏ qua các quy tắc dưới.

| type | Ô nhập | Quy tắc | Chuẩn hóa / thông báo lỗi |
|---|---|---|---|
| `text`, `textarea`, `select` | chữ / đoạn / danh sách | chỉ kiểm tra bắt buộc; `select` phải thuộc `options` | — |
| `cccd` | chữ | bỏ khoảng trắng, đúng `^\d{12}$` | lưu không khoảng trắng · "Số CCCD phải gồm đúng 12 chữ số." |
| `phone` | chữ | bỏ `space . - ( )`; `+84…` → `0…`; `84` + 9 số → `0…`; đúng `^0[35789]\d{8}$` | lưu dạng `0xxxxxxxxx` · "Số điện thoại chưa đúng. Hãy nhập 10 số, bắt đầu bằng 0 (vd: 0901234567)." |
| `email` | chữ | `^[^\s@]+@[^\s@]+\.[^\s@]{2,}$` | "Địa chỉ email không hợp lệ." |
| `number` | chữ (số kiểu VN) | `^\d+([.,]\d{1,2})?$` hoặc `^\d{1,3}(\.\d{3})+(,\d{1,2})?$` (bỏ `m²`, `đồng`, `vnđ`, khoảng trắng). `1,000` là mơ hồ → lỗi | `85,5` → 85.5; `1.250.000` → 1250000 · "Giá trị chưa đúng, ví dụ: 85,5 hoặc 1.250.000" |
| `date` | ngày `YYYY-MM-DD` | ngày hợp lệ | — |
| `past_date` | ngày | ≤ hôm nay | "Ngày không được ở tương lai." |
| `dob` | ngày | ≤ hôm nay | "Ngày sinh không được ở tương lai." |
| `issue_date` | ngày | ≤ hôm nay **và** ≥ trường `dob` trong **cùng thẻ** (nếu thẻ có `dob`) | "Ngày cấp không hợp lệ." |

"Hôm nay" theo giờ Việt Nam (UTC+7).

### 5.2. Kiểm tra `content` khi lưu / xuất bản

- Lưu nháp (`POST`, `PUT`): đúng JSON Schema mục 3; bắt buộc `name`, `domain`. Cho phép mục chưa có tên/chưa có thẻ.
- Xuất bản (`publish`) thêm: ít nhất 1 mục; mỗi mục có `title` và ít nhất 1 thẻ; mỗi `free_field` có `label` không rỗng.
- `instance_id` duy nhất trong mẫu; `sections[].id` duy nhất.
- Với thẻ có sẵn (`block_key` khác `free_field`): `fields` phải khớp thư viện tại thời điểm tạo (key/label/type/required/autofill) — admin không được đổi nhãn. Nếu BE muốn chặn sửa nhãn qua API thì so với bản thư viện BE giữ; nếu không thì ít nhất kiểm tra `type` thuộc danh sách mục 3.

## 6. Tự điền (autofill) → hồ sơ công dân

Nguồn: `GET /api/users/me/citizen-profile` (User service, `CitizenProfileOut`), FE gọi qua `fetchMyCitizenProfile()` trong `auth-api.js`. Chưa khai hồ sơ → `data: null`.
Ánh xạ ở `form-renderer.js` (`profileValues`):

| Khóa autofill | Trường trong response | Ghi chú |
|---|---|---|
| `profile.full_name` | `full_name` | |
| `profile.dob` | `date_of_birth` | `YYYY-MM-DD` |
| `profile.cccd_number` | `id_number` | |
| `profile.cccd_issue_date` | `issue_date` | `YYYY-MM-DD` |
| `profile.cccd_issue_place` | `issue_place` | |
| `profile.permanent_address` | `permanent_address` | object `{ detail, ward, province }` → nối `"detail, ward, province"` |
| `profile.current_address` | `current_address` (hoặc `permanent_address` khi `current_same_as_permanent = true`) | nối như trên |
| `profile.phone` | `phone` | có thể `null` |
| `profile.email` | `email` | |
| `profile.tax_code` | `tax_code` | có thể `null` |


## 7. Điểm lệch FE/BE đã thấy (form schema hiện tại, `procedure_form_service.py`)

Chi tiết từng bộ thẻ: `docs/bo-the-inventory.md`.

| Điểm | BE hiện tại | FE (mẫu đơn dùng chung) | Đề nghị BE |
|---|---|---|---|
| Số CCCD | `^[0-9]{9,12}$` cho mọi loại giấy tờ (`*_id_number`) | `cccd`: đúng 12 số | Kiểu `cccd` đúng 12 số; CMND (9/12) để riêng nếu còn cần |
| Email | Không kiểm tra định dạng ở bộ thẻ nào | Kiểm tra định dạng | Thêm kiểm tra như mục 5.1 |
| Ngày sinh | Chỉ kiểm tra định dạng ngày, nhận cả ngày tương lai; không chặn ngày cấp trước ngày sinh | Chặn tương lai; ngày cấp ≥ ngày sinh cùng thẻ | Thêm 2 quy tắc này |
| `headquarters_phone` | Không có regex (các `*_phone` khác có `^[0-9]{10,11}$`) | Kiểu `phone` như mọi SĐT | Áp cùng quy tắc SĐT, nhận +84 và chuẩn hóa về 0 |
| SĐT nói chung | `^[0-9]{10,11}$`, không nhận `+84`, khoảng trắng | Chuẩn hóa rồi `^0[35789]\d{8}$` | Dùng quy tắc FE |
| Mã số thuế | 6 nhãn khác nhau ("Mã số thuế (nếu có)", "Mã số đăng ký Hộ kinh doanh / Mã số thuế", "Mã số doanh nghiệp / Mã số thuế", "Mã số thuế", "Mã số thuế / Mã số doanh nghiệp", "Mã số doanh nghiệp"), chỗ bắt buộc chỗ không, chưa kiểm tra định dạng | 2 trường: `tax_code` "Mã số thuế" (thẻ Mã số thuế) và `org_code` "Mã số doanh nghiệp/Mã số thuế" (thẻ tổ chức); kiểu `text`, chưa kiểm tra 10/13 số | Thống nhất nhãn và định dạng (10 hoặc 13 số?) rồi FE thêm kiểu `tax_code` |
