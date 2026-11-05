# Kiểm kê các bộ thẻ (thẻ thông tin của mẫu đơn)

Nguồn: backend `develop` (c0b5466), đọc trực tiếp từ `BE/legal-assistant-ai/services/procedure-service/app/services/procedure_form_service.py` (chỉ đọc, không sửa BE) và frontend nhánh `features/ThemMauDonChung_Kien`.
Tạo ngày 2026-10-26.

> Lưu ý: container đang chạy trên máy (D:\AI_03\BE1, nhánh features/Update_Kien) dùng phiên bản form schema **khác** develop
> (ví dụ DD-001 ở BE1 có thêm khối `transferee_*`). Bảng dưới là theo develop.

## 1. Các nơi định nghĩa bộ thẻ

| Nơi | Vai trò |
|---|---|
| `BE/legal-assistant-ai/services/procedure-service/app/services/procedure_form_service.py` | **Nguồn chính**: 26 bộ thẻ (1 bộ / thủ tục), dựng từ 4 khối dùng chung: `get_applicant_block` (dòng 17), `get_land_plot_block` (dòng 122), `get_business_info_block` (dòng 228), `get_fields_mau_so_18` (dòng 320). Ánh xạ mã → hàm: `PROCEDURE_FIELD_DISPATCHER`. Kiểm tra khi lưu: `validate_form_data` / `_format_error` (bắt buộc, kiểu, lựa chọn, regex). |
| API `GET /api/procedures/form-schema/{code}` | Trả bộ thẻ cho frontend. |
| `AI_Legal/src/pages/application-submission.html` | Trang Tạo hồ sơ: dựng ô từ schema (`createSchemaField`), gom vào 3 thẻ bước (bộ thẻ từ commit 448ca32): 1. Người làm đơn · 2. Thông tin thủ tục · 3. Kiểm tra hồ sơ. Kiểm tra khi gửi: `collectSchemaData`. |
| `AI_Legal/public/admin-template-drawer.js` (`DEFAULT_CARDS`) | 2 bộ thẻ mặc định khi admin thêm mẫu đơn: Đất đai (6 thẻ), Hộ kinh doanh (6 thẻ). |
| `AI_Legal/public/field-rules.js` (mới) | Quy tắc dùng chung cho các trường lặp lại (CCCD, SĐT, email, ngày sinh, ngày cấp). |

## 2. Tóm tắt 26 bộ thẻ (backend)

| Mã | Thủ tục | Lĩnh vực | Nguồn (dòng) | Số thẻ | Bắt buộc | Có regex BE |
|---|---|---|---|---:|---:|---:|
| DD-001 | Đăng ký biến động quyền sử dụng đất do chuyển nhượng | Đất đai | `get_fields_dd_001` (437) | 11 | 8 | 1 |
| DD-002 | Cấp đổi Giấy chứng nhận quyền sử dụng đất | Đất đai | `get_fields_dd_002` (450) | 24 | 15 | 2 |
| DD-003 | Tách thửa hoặc hợp thửa đất | Đất đai | `get_fields_dd_003` (481) | 26 | 18 | 2 |
| DD-004 | Thủ tục đăng ký đất đai, cấp Giấy chứng nhận lần đầu | Đất đai | `get_fields_dd_004` (527) | 25 | 16 | 2 |
| DD-005 | Thủ tục cấp lại Giấy chứng nhận do bị mất | Đất đai | `get_fields_dd_005` (561) | 25 | 17 | 2 |
| DD-006 | Thủ tục đăng ký biến động do tặng cho, thừa kế quyền sử dụng đất, nhà ở | Đất đai | `get_fields_dd_006` (594) | 11 | 8 | 1 |
| DD-007 | Thủ tục đính chính Giấy chứng nhận đã cấp do sai sót thông tin | Đất đai | `get_fields_dd_007` (607) | 25 | 17 | 2 |
| DD-008 | Thủ tục chuyển mục đích sử dụng đất | Đất đai | `get_fields_dd_008` (645) | 26 | 18 | 2 |
| DD-009 | Thủ tục gia hạn thời hạn sử dụng đất | Đất đai | `get_fields_dd_009` (691) | 25 | 17 | 2 |
| DD-010 | Thủ tục đăng ký thế chấp quyền sử dụng đất, tài sản gắn liền với đất | Đất đai | `get_fields_dd_010` (723) | 27 | 19 | 2 |
| DD-011 | Thủ tục xóa đăng ký thế chấp quyền sử dụng đất (Giải chấp Sổ đỏ) | Đất đai | `get_fields_dd_011` (770) | 25 | 17 | 2 |
| DD-012 | Thủ tục cung cấp thông tin, dữ liệu đất đai, trích lục bản đồ địa chính | Đất đai | `get_fields_dd_012` (803) | 24 | 16 | 2 |
| HKD-001 | Đăng ký thành lập hộ kinh doanh | Kinh doanh | `get_fields_hkd_001` (837) | 17 | 14 | 2 |
| HKD-002 | Thay đổi nội dung đăng ký hộ kinh doanh | Kinh doanh | `get_fields_hkd_002` (894) | 16 | 14 | 2 |
| HKD-003 | Chấm dứt hoạt động hộ kinh doanh | Kinh doanh | `get_fields_hkd_003` (945) | 17 | 15 | 2 |
| DN-001 | Thủ tục ủy quyền thực hiện thủ tục đăng ký doanh nghiệp | Kinh doanh | `get_fields_dn_001` (1004) | 25 | 21 | 4 |
| DN-002 | Thủ tục đề nghị cấp lại Giấy chứng nhận đăng ký doanh nghiệp | Kinh doanh | `get_fields_dn_002` (1036) | 14 | 12 | 2 |
| DN-003 | Thủ tục đăng ký thành lập Công ty Cổ phần | Kinh doanh | `get_fields_dn_003` (1070) | 25 | 19 | 2 |
| DN-004 | Thủ tục đăng ký thành lập Công ty Trách nhiệm hữu hạn | Kinh doanh | `get_fields_dn_004` (1116) | 23 | 17 | 2 |
| DN-005 | Thủ tục đăng ký thành lập Doanh nghiệp tư nhân | Kinh doanh | `get_fields_dn_005` (1150) | 22 | 16 | 2 |
| DN-006 | Thủ tục thuê nhà/mặt bằng làm Trụ sở chính doanh nghiệp | Kinh doanh | `get_fields_dn_006` (1168) | 27 | 23 | 4 |
| DN-007 | Thủ tục đăng ký thuế, khai thuế ban đầu | Kinh doanh | `get_fields_dn_007` (1217) | 16 | 14 | 2 |
| DN-008 | Thủ tục đăng ký thành lập Công ty Hợp danh | Kinh doanh | `get_fields_dn_008` (1272) | 22 | 16 | 2 |
| DN-009 | Thủ tục đăng ký giải thể doanh nghiệp | Kinh doanh | `get_fields_dn_009` (1289) | 15 | 13 | 2 |
| DN-010 | Thủ tục thông báo tạm ngừng / Cấp đổi thông tin ĐKDN | Kinh doanh | `get_fields_dn_010` (1328) | 16 | 14 | 2 |
| DN-011 | Thủ tục đăng ký thay đổi nội dung Đăng ký doanh nghiệp | Kinh doanh | `get_fields_dn_011` (1373) | 16 | 14 | 2 |
| **Tổng** | | | | **545** | | |

Thêm 2 bộ thẻ mặc định ở khung admin: Đất đai 6 thẻ, Hộ kinh doanh 6 thẻ.

## 3. Trường dùng chung nhiều thẻ ("1 trường có nhiều thẻ")

Cùng một trường logic xuất hiện ở nhiều bộ thẻ, thường với tiền tố người khác nhau (`applicant_`, `authorizer_`, `authorized_person_`, `lessor_`, `lessee_`).

| Trường logic | Tên trường (key) | Số bộ thẻ | Kiểu | Bắt buộc | Kiểm tra BE | Quy tắc FE (mới) | Nhất quán? |
|---|---|---:|---|---|---|---|---|
| Họ tên | `applicant_name`, `declarer_signature_name`, `authorizer_name`, `authorized_person_name`, `lessor_name`, `lessee_name` | 26 | text | có | — | — | ⚠️ 3 nhãn khác nhau |
| Giới tính | `applicant_gender`, `authorizer_gender`, `authorized_person_gender`, `lessor_gender`, `lessee_gender` | 24 | select | có | — | — | ✓ |
| Ngày sinh | `applicant_dob`, `authorizer_dob`, `authorized_person_dob`, `lessor_dob`, `lessee_dob` | 24 | date | có | — | Không ở tương lai | ✓ |
| Loại giấy tờ | `applicant_id_type`, `authorizer_id_type`, `authorized_person_id_type`, `lessor_id_type`, `lessee_id_type` | 24 | select | có | — | — | ✓ |
| Số CCCD/định danh | `applicant_id_number`, `authorizer_id_number`, `authorized_person_id_number`, `lessor_id_number`, `lessee_id_number` | 24 | text | có | ^[0-9]{9,12}$ | CCCD (12 số; CMND 9/12) | ✓ |
| Ngày cấp CCCD | `applicant_id_issue_date`, `authorizer_id_issue_date`, `authorized_person_id_issue_date`, `lessor_id_issue_date`, `lessee_id_issue_date` | 24 | date | có | — | Không tương lai, ≥ ngày sinh | ✓ |
| Nơi cấp | `applicant_id_issue_place`, `authorizer_id_issue_place`, `authorized_person_id_issue_place`, `lessor_id_issue_place`, `lessee_id_issue_place` | 24 | text | có | — | — | ✓ |
| Số điện thoại | `applicant_phone`, `headquarters_phone`, `authorizer_phone`, `authorized_person_phone`, `lessor_phone`, `lessee_phone` | 26 | text | có | ^[0-9]{10,11}$ / — | SĐT VN (chuẩn hóa +84) | ⚠️ regex chỗ có chỗ không (^[0-9]{10,11}$ / —); 3 nhãn khác nhau |
| Email | `applicant_email`, `authorizer_email`, `authorized_person_email`, `headquarters_email`, `lessor_email`, `lessee_email` | 26 | text | không | — | Email | ⚠️ 3 nhãn khác nhau |
| Địa chỉ thường trú | `applicant_permanent_address`, `authorizer_permanent_address`, `authorized_person_permanent_address`, `lessor_permanent_address`, `lessee_permanent_address` | 24 | textarea | có | — | — | ✓ |
| Nơi ở hiện nay | `applicant_current_address`, `authorizer_current_address`, `authorized_person_current_address`, `lessor_current_address`, `lessee_current_address` | 24 | textarea | không | — | — | ✓ |
| Diện tích | `land_area`, `split_target_area`, `conversion_area`, `rental_area` | 11 | number/textarea | có | — | Số kiểu VN (85,5 / 1.250.000) | ⚠️ kiểu khác nhau (number/textarea); 4 nhãn khác nhau |
| Ngày cấp GCN | `certificate_issue_date` | 10 | date | không | — | Không ở tương lai | ✓ |
| Mã số thuế / mã số DN | `applicant_tax_code`, `business_code` | 9 | text | không/có | — | — | ⚠️ chỗ bắt buộc chỗ không; 6 nhãn khác nhau |
| Tiền (VNĐ) | `secured_obligation_amount`, `charter_capital`, `par_value_per_share`, `rental_price`, `rental_deposit` | 7 | number | có | — | Số kiểu VN (85,5 / 1.250.000) | ⚠️ 6 nhãn khác nhau |

### Điểm chưa nhất quán

- **Họ tên**: 3 nhãn khác nhau. Nhãn: "Họ và tên cá nhân / Tên tổ chức (chữ in hoa)", "Họ và tên người viết đơn (Người làm đơn ký và ghi rõ họ tên)", "Họ và tên người làm đơn".
- **Số điện thoại**: regex chỗ có chỗ không (^[0-9]{10,11}$ / —); 3 nhãn khác nhau. Nhãn: "Điện thoại liên hệ", "Số điện thoại liên hệ", "Điện thoại trụ sở".
- **Email**: 3 nhãn khác nhau. Nhãn: "Hộp thư điện tử (nếu có)", "Địa chỉ email", "Email trụ sở".
- **Diện tích**: kiểu khác nhau (number/textarea); 4 nhãn khác nhau. Nhãn: "Diện tích thửa đất (m²)", "Diện tích từng thửa dự kiến tách (m²)", "Diện tích xin chuyển mục đích (m²)", "Diện tích thuê (m²)".
- **Mã số thuế / mã số DN**: chỗ bắt buộc chỗ không; 6 nhãn khác nhau. Nhãn: "Mã số thuế (nếu có)", "Mã số đăng ký Hộ kinh doanh / Mã số thuế", "Mã số doanh nghiệp / Mã số thuế", "Mã số thuế", "Mã số thuế / Mã số doanh nghiệp", "Mã số doanh nghiệp".
- **Tiền (VNĐ)**: 6 nhãn khác nhau. Nhãn: "Giá trị nghĩa vụ được bảo đảm (VNĐ)", "Số vốn kinh doanh (VNĐ)", "Vốn điều lệ / Vốn kinh doanh (VNĐ)", "Mệnh giá mỗi cổ phần (VNĐ)", "Giá thuê hàng tháng (VNĐ)", "Tiền đặt cọc (VNĐ)".
- **CCCD**: BE chấp nhận 9–12 chữ số (`^[0-9]{9,12}$`) cho mọi loại giấy tờ; trang Cập nhật thông tin cá nhân yêu cầu đúng 12 số. FE mới: CCCD đúng 12 số, CMND 9 hoặc 12 số, Hộ chiếu để BE kiểm tra.
- **Số điện thoại**: BE `^[0-9]{10,11}$` chỉ đặt cho `applicant_/authorizer_/...phone`, **không** đặt cho `headquarters_phone`; trang đăng ký dùng 10 số đầu 03/05/07/08/09 và chấp nhận +84. FE mới áp cùng một quy tắc cho mọi `*_phone` và gửi số đã chuẩn hóa (0xxxxxxxxx), vẫn khớp regex BE.
- **Email**: BE không kiểm tra định dạng email ở bất kỳ bộ thẻ nào.
- **Ngày sinh / ngày cấp**: BE chỉ kiểm tra định dạng ngày, không chặn ngày tương lai hay ngày cấp trước ngày sinh.
- **Mã số thuế** (`business_code`, `applicant_tax_code`): chưa có kiểm tra (10 hoặc 13 số). Chưa thêm vì cần thống nhất định dạng với nhóm BE.
- **Họ tên**: `applicant_name` có nhãn "Họ và tên cá nhân / Tên tổ chức" ở một số thủ tục doanh nghiệp nên không áp quy tắc "chỉ chữ cái" như trang đăng ký.

## 4. Chi tiết từng bộ thẻ

<details><summary><b>DD-001</b> · Đăng ký biến động quyền sử dụng đất do chuyển nhượng (11 thẻ)</summary>

| # | Key | Nhãn | Kiểu | Bắt buộc | Nhóm | Kiểm tra BE | Quy tắc FE |
|---:|---|---|---|---|---|---|---|
| 1 | `receiving_agency` | Kính gửi (Cơ quan tiếp nhận giải quyết) | text | có | 1. Cơ quan tiếp nhận giải quyết | — | — |
| 2 | `applicant_name` | Họ và tên cá nhân / Tên tổ chức (chữ in hoa) | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 3 | `applicant_id_document` | Giấy tờ nhân thân / pháp nhân (Số CCCD, ngày cấp, nơi cấp) | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 4 | `applicant_address` | Địa chỉ nơi đăng ký thường trú / Trụ sở chính | textarea | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 5 | `applicant_tax_code` | Mã số thuế (nếu có) | text | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 6 | `applicant_phone` | Điện thoại liên hệ | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{10,11}$` | SĐT VN (chuẩn hóa +84) |
| 7 | `applicant_email` | Hộp thư điện tử (nếu có) | text | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | Email |
| 8 | `change_content` | Nội dung biến động đề nghị đăng ký | textarea | có | II. Nội dung biến động | — | — |
| 9 | `tax_exemption_info` | Thông tin đối tượng được miễn, giảm nghĩa vụ tài chính về đất đai (nếu có) | textarea | không | III. Thông tin đối tượng được miễn, giảm nghĩa vụ tài chính về đất đai | — | — |
| 10 | `attached_documents` | Giấy tờ liên quan đến nội dung biến động nộp kèm theo đơn | textarea | có | IV. Giấy tờ liên quan đến nội dung biến động nộp kèm theo đơn | — | — |
| 11 | `declarer_signature_name` | Họ và tên người viết đơn (Người làm đơn ký và ghi rõ họ tên) | text | có | 6. Cam đoan và Xác nhận của người làm đơn | — | — |

</details>

<details><summary><b>DD-002</b> · Cấp đổi Giấy chứng nhận quyền sử dụng đất (24 thẻ)</summary>

| # | Key | Nhãn | Kiểu | Bắt buộc | Nhóm | Kiểm tra BE | Quy tắc FE |
|---:|---|---|---|---|---|---|---|
| 1 | `applicant_name` | Họ và tên người làm đơn | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 2 | `applicant_gender` | Giới tính | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 3 | `applicant_dob` | Ngày tháng năm sinh | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không ở tương lai |
| 4 | `applicant_id_type` | Loại giấy tờ định danh | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 5 | `applicant_id_number` | Số CCCD/Định danh cá nhân | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{9,12}$` | CCCD (12 số; CMND 9/12) |
| 6 | `applicant_id_issue_date` | Ngày cấp CCCD | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không tương lai, ≥ ngày sinh |
| 7 | `applicant_id_issue_place` | Nơi cấp | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 8 | `applicant_phone` | Số điện thoại liên hệ | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{10,11}$` | SĐT VN (chuẩn hóa +84) |
| 9 | `applicant_email` | Địa chỉ email | text | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | Email |
| 10 | `applicant_permanent_address` | Nơi đăng ký thường trú | textarea | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 11 | `applicant_current_address` | Nơi ở hiện nay | textarea | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 12 | `plot_number` | Thửa đất số | text | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 13 | `map_sheet_number` | Tờ bản đồ số | text | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 14 | `land_address` | Địa chỉ thửa đất | textarea | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 15 | `land_area` | Diện tích thửa đất (m²) | number | có | 2. Thông tin thửa đất / Bất động sản | phải là số | Số kiểu VN (85,5 / 1.250.000) |
| 16 | `land_use_purpose` | Mục đích sử dụng đất | select | có | 2. Thông tin thửa đất / Bất động sản | chọn trong 7 mục | — |
| 17 | `land_use_term` | Thời hạn sử dụng đất | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 18 | `land_use_origin` | Nguồn gốc sử dụng đất | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 19 | `certificate_number` | Số seri Giấy chứng nhận (Số phát hành) | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 20 | `certificate_book_number` | Số vào sổ cấp GCN | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 21 | `certificate_issue_date` | Ngày cấp Giấy chứng nhận | date | không | 2. Thông tin thửa đất / Bất động sản | YYYY-MM-DD | Không ở tương lai |
| 22 | `certificate_issue_agency` | Cơ quan cấp GCN | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 23 | `reissue_reason` | Lý do đề nghị cấp đổi | select | có | 3. Yêu cầu giải quyết thủ tục | chọn trong 4 mục | — |
| 24 | `survey_request_reason` | Thông tin bản vẽ đo đạc lại (nếu có) | textarea | không | 3. Yêu cầu giải quyết thủ tục | — | — |

</details>

<details><summary><b>DD-003</b> · Tách thửa hoặc hợp thửa đất (26 thẻ)</summary>

| # | Key | Nhãn | Kiểu | Bắt buộc | Nhóm | Kiểm tra BE | Quy tắc FE |
|---:|---|---|---|---|---|---|---|
| 1 | `applicant_name` | Họ và tên người làm đơn | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 2 | `applicant_gender` | Giới tính | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 3 | `applicant_dob` | Ngày tháng năm sinh | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không ở tương lai |
| 4 | `applicant_id_type` | Loại giấy tờ định danh | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 5 | `applicant_id_number` | Số CCCD/Định danh cá nhân | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{9,12}$` | CCCD (12 số; CMND 9/12) |
| 6 | `applicant_id_issue_date` | Ngày cấp CCCD | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không tương lai, ≥ ngày sinh |
| 7 | `applicant_id_issue_place` | Nơi cấp | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 8 | `applicant_phone` | Số điện thoại liên hệ | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{10,11}$` | SĐT VN (chuẩn hóa +84) |
| 9 | `applicant_email` | Địa chỉ email | text | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | Email |
| 10 | `applicant_permanent_address` | Nơi đăng ký thường trú | textarea | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 11 | `applicant_current_address` | Nơi ở hiện nay | textarea | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 12 | `plot_number` | Thửa đất số | text | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 13 | `map_sheet_number` | Tờ bản đồ số | text | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 14 | `land_address` | Địa chỉ thửa đất | textarea | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 15 | `land_area` | Diện tích thửa đất (m²) | number | có | 2. Thông tin thửa đất / Bất động sản | phải là số | Số kiểu VN (85,5 / 1.250.000) |
| 16 | `land_use_purpose` | Mục đích sử dụng đất | select | có | 2. Thông tin thửa đất / Bất động sản | chọn trong 7 mục | — |
| 17 | `land_use_term` | Thời hạn sử dụng đất | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 18 | `land_use_origin` | Nguồn gốc sử dụng đất | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 19 | `certificate_number` | Số seri Giấy chứng nhận (Số phát hành) | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 20 | `certificate_book_number` | Số vào sổ cấp GCN | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 21 | `certificate_issue_date` | Ngày cấp Giấy chứng nhận | date | không | 2. Thông tin thửa đất / Bất động sản | YYYY-MM-DD | Không ở tương lai |
| 22 | `certificate_issue_agency` | Cơ quan cấp GCN | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 23 | `split_merge_type` | Hình thức yêu cầu | select | có | 3. Yêu cầu giải quyết thủ tục | chọn trong 2 mục | — |
| 24 | `split_plots_count` | Số lượng thửa đất dự kiến sau khi tách/hợp | number | có | 3. Yêu cầu giải quyết thủ tục | phải là số | Số kiểu VN (85,5 / 1.250.000) |
| 25 | `split_target_area` | Diện tích từng thửa dự kiến tách (m²) | textarea | có | 3. Yêu cầu giải quyết thủ tục | — | — |
| 26 | `split_reason` | Lý do đề nghị tách/hợp thửa | textarea | có | 3. Yêu cầu giải quyết thủ tục | — | — |

</details>

<details><summary><b>DD-004</b> · Thủ tục đăng ký đất đai, cấp Giấy chứng nhận lần đầu (25 thẻ)</summary>

| # | Key | Nhãn | Kiểu | Bắt buộc | Nhóm | Kiểm tra BE | Quy tắc FE |
|---:|---|---|---|---|---|---|---|
| 1 | `applicant_name` | Họ và tên người làm đơn | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 2 | `applicant_gender` | Giới tính | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 3 | `applicant_dob` | Ngày tháng năm sinh | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không ở tương lai |
| 4 | `applicant_id_type` | Loại giấy tờ định danh | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 5 | `applicant_id_number` | Số CCCD/Định danh cá nhân | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{9,12}$` | CCCD (12 số; CMND 9/12) |
| 6 | `applicant_id_issue_date` | Ngày cấp CCCD | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không tương lai, ≥ ngày sinh |
| 7 | `applicant_id_issue_place` | Nơi cấp | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 8 | `applicant_phone` | Số điện thoại liên hệ | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{10,11}$` | SĐT VN (chuẩn hóa +84) |
| 9 | `applicant_email` | Địa chỉ email | text | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | Email |
| 10 | `applicant_permanent_address` | Nơi đăng ký thường trú | textarea | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 11 | `applicant_current_address` | Nơi ở hiện nay | textarea | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 12 | `plot_number` | Thửa đất số | text | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 13 | `map_sheet_number` | Tờ bản đồ số | text | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 14 | `land_address` | Địa chỉ thửa đất | textarea | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 15 | `land_area` | Diện tích thửa đất (m²) | number | có | 2. Thông tin thửa đất / Bất động sản | phải là số | Số kiểu VN (85,5 / 1.250.000) |
| 16 | `land_use_purpose` | Mục đích sử dụng đất | select | có | 2. Thông tin thửa đất / Bất động sản | chọn trong 7 mục | — |
| 17 | `land_use_term` | Thời hạn sử dụng đất | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 18 | `land_use_origin` | Nguồn gốc sử dụng đất | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 19 | `certificate_number` | Số seri Giấy chứng nhận (Số phát hành) | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 20 | `certificate_book_number` | Số vào sổ cấp GCN | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 21 | `certificate_issue_date` | Ngày cấp Giấy chứng nhận | date | không | 2. Thông tin thửa đất / Bất động sản | YYYY-MM-DD | Không ở tương lai |
| 22 | `certificate_issue_agency` | Cơ quan cấp GCN | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 23 | `land_origin_detail` | Thời điểm và nguồn gốc bắt đầu sử dụng đất | textarea | có | 3. Nguồn gốc đất đai & Cam kết | — | — |
| 24 | `house_construction_year` | Tài sản gắn liền với đất (Nhà ở/Công trình) | textarea | không | 3. Nguồn gốc đất đai & Cam kết | — | — |
| 25 | `dispute_commitment` | Cam kết ranh giới và tình trạng tranh chấp | checkbox | có | 3. Nguồn gốc đất đai & Cam kết | true/false | — |

</details>

<details><summary><b>DD-005</b> · Thủ tục cấp lại Giấy chứng nhận do bị mất (25 thẻ)</summary>

| # | Key | Nhãn | Kiểu | Bắt buộc | Nhóm | Kiểm tra BE | Quy tắc FE |
|---:|---|---|---|---|---|---|---|
| 1 | `applicant_name` | Họ và tên người làm đơn | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 2 | `applicant_gender` | Giới tính | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 3 | `applicant_dob` | Ngày tháng năm sinh | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không ở tương lai |
| 4 | `applicant_id_type` | Loại giấy tờ định danh | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 5 | `applicant_id_number` | Số CCCD/Định danh cá nhân | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{9,12}$` | CCCD (12 số; CMND 9/12) |
| 6 | `applicant_id_issue_date` | Ngày cấp CCCD | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không tương lai, ≥ ngày sinh |
| 7 | `applicant_id_issue_place` | Nơi cấp | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 8 | `applicant_phone` | Số điện thoại liên hệ | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{10,11}$` | SĐT VN (chuẩn hóa +84) |
| 9 | `applicant_email` | Địa chỉ email | text | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | Email |
| 10 | `applicant_permanent_address` | Nơi đăng ký thường trú | textarea | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 11 | `applicant_current_address` | Nơi ở hiện nay | textarea | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 12 | `plot_number` | Thửa đất số | text | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 13 | `map_sheet_number` | Tờ bản đồ số | text | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 14 | `land_address` | Địa chỉ thửa đất | textarea | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 15 | `land_area` | Diện tích thửa đất (m²) | number | có | 2. Thông tin thửa đất / Bất động sản | phải là số | Số kiểu VN (85,5 / 1.250.000) |
| 16 | `land_use_purpose` | Mục đích sử dụng đất | select | có | 2. Thông tin thửa đất / Bất động sản | chọn trong 7 mục | — |
| 17 | `land_use_term` | Thời hạn sử dụng đất | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 18 | `land_use_origin` | Nguồn gốc sử dụng đất | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 19 | `certificate_number` | Số seri Giấy chứng nhận (Số phát hành) | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 20 | `certificate_book_number` | Số vào sổ cấp GCN | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 21 | `certificate_issue_date` | Ngày cấp Giấy chứng nhận | date | không | 2. Thông tin thửa đất / Bất động sản | YYYY-MM-DD | Không ở tương lai |
| 22 | `certificate_issue_agency` | Cơ quan cấp GCN | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 23 | `loss_reason` | Lý do bị mất Giấy chứng nhận | textarea | có | 3. Yêu cầu giải quyết thủ tục | — | — |
| 24 | `loss_report_date` | Ngày khai báo mất tại UBND cấp xã | date | có | 3. Yêu cầu giải quyết thủ tục | YYYY-MM-DD | — |
| 25 | `loss_commitment` | Cam kết không mang đi thế chấp | checkbox | có | 3. Yêu cầu giải quyết thủ tục | true/false | — |

</details>

<details><summary><b>DD-006</b> · Thủ tục đăng ký biến động do tặng cho, thừa kế quyền sử dụng đất, nhà ở (11 thẻ)</summary>

| # | Key | Nhãn | Kiểu | Bắt buộc | Nhóm | Kiểm tra BE | Quy tắc FE |
|---:|---|---|---|---|---|---|---|
| 1 | `receiving_agency` | Kính gửi (Cơ quan tiếp nhận giải quyết) | text | có | 1. Cơ quan tiếp nhận giải quyết | — | — |
| 2 | `applicant_name` | Họ và tên cá nhân / Tên tổ chức (chữ in hoa) | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 3 | `applicant_id_document` | Giấy tờ nhân thân / pháp nhân (Số CCCD, ngày cấp, nơi cấp) | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 4 | `applicant_address` | Địa chỉ nơi đăng ký thường trú / Trụ sở chính | textarea | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 5 | `applicant_tax_code` | Mã số thuế (nếu có) | text | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 6 | `applicant_phone` | Điện thoại liên hệ | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{10,11}$` | SĐT VN (chuẩn hóa +84) |
| 7 | `applicant_email` | Hộp thư điện tử (nếu có) | text | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | Email |
| 8 | `change_content` | Nội dung biến động đề nghị đăng ký | textarea | có | II. Nội dung biến động | — | — |
| 9 | `tax_exemption_info` | Thông tin đối tượng được miễn, giảm nghĩa vụ tài chính về đất đai (nếu có) | textarea | không | III. Thông tin đối tượng được miễn, giảm nghĩa vụ tài chính về đất đai | — | — |
| 10 | `attached_documents` | Giấy tờ liên quan đến nội dung biến động nộp kèm theo đơn | textarea | có | IV. Giấy tờ liên quan đến nội dung biến động nộp kèm theo đơn | — | — |
| 11 | `declarer_signature_name` | Họ và tên người viết đơn (Người làm đơn ký và ghi rõ họ tên) | text | có | 6. Cam đoan và Xác nhận của người làm đơn | — | — |

</details>

<details><summary><b>DD-007</b> · Thủ tục đính chính Giấy chứng nhận đã cấp do sai sót thông tin (25 thẻ)</summary>

| # | Key | Nhãn | Kiểu | Bắt buộc | Nhóm | Kiểm tra BE | Quy tắc FE |
|---:|---|---|---|---|---|---|---|
| 1 | `applicant_name` | Họ và tên người làm đơn | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 2 | `applicant_gender` | Giới tính | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 3 | `applicant_dob` | Ngày tháng năm sinh | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không ở tương lai |
| 4 | `applicant_id_type` | Loại giấy tờ định danh | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 5 | `applicant_id_number` | Số CCCD/Định danh cá nhân | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{9,12}$` | CCCD (12 số; CMND 9/12) |
| 6 | `applicant_id_issue_date` | Ngày cấp CCCD | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không tương lai, ≥ ngày sinh |
| 7 | `applicant_id_issue_place` | Nơi cấp | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 8 | `applicant_phone` | Số điện thoại liên hệ | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{10,11}$` | SĐT VN (chuẩn hóa +84) |
| 9 | `applicant_email` | Địa chỉ email | text | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | Email |
| 10 | `applicant_permanent_address` | Nơi đăng ký thường trú | textarea | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 11 | `applicant_current_address` | Nơi ở hiện nay | textarea | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 12 | `plot_number` | Thửa đất số | text | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 13 | `map_sheet_number` | Tờ bản đồ số | text | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 14 | `land_address` | Địa chỉ thửa đất | textarea | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 15 | `land_area` | Diện tích thửa đất (m²) | number | có | 2. Thông tin thửa đất / Bất động sản | phải là số | Số kiểu VN (85,5 / 1.250.000) |
| 16 | `land_use_purpose` | Mục đích sử dụng đất | select | có | 2. Thông tin thửa đất / Bất động sản | chọn trong 7 mục | — |
| 17 | `land_use_term` | Thời hạn sử dụng đất | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 18 | `land_use_origin` | Nguồn gốc sử dụng đất | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 19 | `certificate_number` | Số seri Giấy chứng nhận (Số phát hành) | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 20 | `certificate_book_number` | Số vào sổ cấp GCN | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 21 | `certificate_issue_date` | Ngày cấp Giấy chứng nhận | date | không | 2. Thông tin thửa đất / Bất động sản | YYYY-MM-DD | Không ở tương lai |
| 22 | `certificate_issue_agency` | Cơ quan cấp GCN | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 23 | `correction_field` | Nội dung thông tin bị sai sót | select | có | 3. Yêu cầu giải quyết thủ tục | chọn trong 3 mục | — |
| 24 | `correction_wrong_value` | Thông tin ghi sai trên Giấy chứng nhận | textarea | có | 3. Yêu cầu giải quyết thủ tục | — | — |
| 25 | `correction_correct_value` | Thông tin đúng theo giấy tờ pháp lý gốc | textarea | có | 3. Yêu cầu giải quyết thủ tục | — | — |

</details>

<details><summary><b>DD-008</b> · Thủ tục chuyển mục đích sử dụng đất (26 thẻ)</summary>

| # | Key | Nhãn | Kiểu | Bắt buộc | Nhóm | Kiểm tra BE | Quy tắc FE |
|---:|---|---|---|---|---|---|---|
| 1 | `applicant_name` | Họ và tên người làm đơn | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 2 | `applicant_gender` | Giới tính | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 3 | `applicant_dob` | Ngày tháng năm sinh | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không ở tương lai |
| 4 | `applicant_id_type` | Loại giấy tờ định danh | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 5 | `applicant_id_number` | Số CCCD/Định danh cá nhân | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{9,12}$` | CCCD (12 số; CMND 9/12) |
| 6 | `applicant_id_issue_date` | Ngày cấp CCCD | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không tương lai, ≥ ngày sinh |
| 7 | `applicant_id_issue_place` | Nơi cấp | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 8 | `applicant_phone` | Số điện thoại liên hệ | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{10,11}$` | SĐT VN (chuẩn hóa +84) |
| 9 | `applicant_email` | Địa chỉ email | text | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | Email |
| 10 | `applicant_permanent_address` | Nơi đăng ký thường trú | textarea | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 11 | `applicant_current_address` | Nơi ở hiện nay | textarea | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 12 | `plot_number` | Thửa đất số | text | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 13 | `map_sheet_number` | Tờ bản đồ số | text | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 14 | `land_address` | Địa chỉ thửa đất | textarea | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 15 | `land_area` | Diện tích thửa đất (m²) | number | có | 2. Thông tin thửa đất / Bất động sản | phải là số | Số kiểu VN (85,5 / 1.250.000) |
| 16 | `land_use_purpose` | Mục đích sử dụng đất | select | có | 2. Thông tin thửa đất / Bất động sản | chọn trong 7 mục | — |
| 17 | `land_use_term` | Thời hạn sử dụng đất | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 18 | `land_use_origin` | Nguồn gốc sử dụng đất | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 19 | `certificate_number` | Số seri Giấy chứng nhận (Số phát hành) | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 20 | `certificate_book_number` | Số vào sổ cấp GCN | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 21 | `certificate_issue_date` | Ngày cấp Giấy chứng nhận | date | không | 2. Thông tin thửa đất / Bất động sản | YYYY-MM-DD | Không ở tương lai |
| 22 | `certificate_issue_agency` | Cơ quan cấp GCN | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 23 | `conversion_from_purpose` | Mục đích sử dụng đất hiện tại | text | có | 3. Thông tin chuyển mục đích sử dụng | — | — |
| 24 | `conversion_to_purpose` | Mục đích sử dụng đất xin chuyển sang | select | có | 3. Thông tin chuyển mục đích sử dụng | chọn trong 3 mục | — |
| 25 | `conversion_area` | Diện tích xin chuyển mục đích (m²) | number | có | 3. Thông tin chuyển mục đích sử dụng | phải là số | Số kiểu VN (85,5 / 1.250.000) |
| 26 | `conversion_reason` | Lý do xin chuyển mục đích | textarea | có | 3. Thông tin chuyển mục đích sử dụng | — | — |

</details>

<details><summary><b>DD-009</b> · Thủ tục gia hạn thời hạn sử dụng đất (25 thẻ)</summary>

| # | Key | Nhãn | Kiểu | Bắt buộc | Nhóm | Kiểm tra BE | Quy tắc FE |
|---:|---|---|---|---|---|---|---|
| 1 | `applicant_name` | Họ và tên người làm đơn | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 2 | `applicant_gender` | Giới tính | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 3 | `applicant_dob` | Ngày tháng năm sinh | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không ở tương lai |
| 4 | `applicant_id_type` | Loại giấy tờ định danh | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 5 | `applicant_id_number` | Số CCCD/Định danh cá nhân | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{9,12}$` | CCCD (12 số; CMND 9/12) |
| 6 | `applicant_id_issue_date` | Ngày cấp CCCD | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không tương lai, ≥ ngày sinh |
| 7 | `applicant_id_issue_place` | Nơi cấp | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 8 | `applicant_phone` | Số điện thoại liên hệ | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{10,11}$` | SĐT VN (chuẩn hóa +84) |
| 9 | `applicant_email` | Địa chỉ email | text | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | Email |
| 10 | `applicant_permanent_address` | Nơi đăng ký thường trú | textarea | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 11 | `applicant_current_address` | Nơi ở hiện nay | textarea | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 12 | `plot_number` | Thửa đất số | text | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 13 | `map_sheet_number` | Tờ bản đồ số | text | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 14 | `land_address` | Địa chỉ thửa đất | textarea | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 15 | `land_area` | Diện tích thửa đất (m²) | number | có | 2. Thông tin thửa đất / Bất động sản | phải là số | Số kiểu VN (85,5 / 1.250.000) |
| 16 | `land_use_purpose` | Mục đích sử dụng đất | select | có | 2. Thông tin thửa đất / Bất động sản | chọn trong 7 mục | — |
| 17 | `land_use_term` | Thời hạn sử dụng đất | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 18 | `land_use_origin` | Nguồn gốc sử dụng đất | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 19 | `certificate_number` | Số seri Giấy chứng nhận (Số phát hành) | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 20 | `certificate_book_number` | Số vào sổ cấp GCN | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 21 | `certificate_issue_date` | Ngày cấp Giấy chứng nhận | date | không | 2. Thông tin thửa đất / Bất động sản | YYYY-MM-DD | Không ở tương lai |
| 22 | `certificate_issue_agency` | Cơ quan cấp GCN | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 23 | `current_expired_date` | Thời hạn sử dụng đất ghi trên GCN hết hạn ngày | date | có | 3. Yêu cầu giải quyết thủ tục | YYYY-MM-DD | — |
| 24 | `extension_duration_years` | Thời gian đề nghị gia hạn (số năm) | number | có | 3. Yêu cầu giải quyết thủ tục | phải là số | Số kiểu VN (85,5 / 1.250.000) |
| 25 | `extension_reason` | Lý do đề nghị gia hạn / xác nhận tiếp tục sử dụng | textarea | có | 3. Yêu cầu giải quyết thủ tục | — | — |

</details>

<details><summary><b>DD-010</b> · Thủ tục đăng ký thế chấp quyền sử dụng đất, tài sản gắn liền với đất (27 thẻ)</summary>

| # | Key | Nhãn | Kiểu | Bắt buộc | Nhóm | Kiểm tra BE | Quy tắc FE |
|---:|---|---|---|---|---|---|---|
| 1 | `applicant_name` | Họ và tên người làm đơn | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 2 | `applicant_gender` | Giới tính | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 3 | `applicant_dob` | Ngày tháng năm sinh | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không ở tương lai |
| 4 | `applicant_id_type` | Loại giấy tờ định danh | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 5 | `applicant_id_number` | Số CCCD/Định danh cá nhân | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{9,12}$` | CCCD (12 số; CMND 9/12) |
| 6 | `applicant_id_issue_date` | Ngày cấp CCCD | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không tương lai, ≥ ngày sinh |
| 7 | `applicant_id_issue_place` | Nơi cấp | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 8 | `applicant_phone` | Số điện thoại liên hệ | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{10,11}$` | SĐT VN (chuẩn hóa +84) |
| 9 | `applicant_email` | Địa chỉ email | text | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | Email |
| 10 | `applicant_permanent_address` | Nơi đăng ký thường trú | textarea | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 11 | `applicant_current_address` | Nơi ở hiện nay | textarea | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 12 | `plot_number` | Thửa đất số | text | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 13 | `map_sheet_number` | Tờ bản đồ số | text | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 14 | `land_address` | Địa chỉ thửa đất | textarea | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 15 | `land_area` | Diện tích thửa đất (m²) | number | có | 2. Thông tin thửa đất / Bất động sản | phải là số | Số kiểu VN (85,5 / 1.250.000) |
| 16 | `land_use_purpose` | Mục đích sử dụng đất | select | có | 2. Thông tin thửa đất / Bất động sản | chọn trong 7 mục | — |
| 17 | `land_use_term` | Thời hạn sử dụng đất | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 18 | `land_use_origin` | Nguồn gốc sử dụng đất | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 19 | `certificate_number` | Số seri Giấy chứng nhận (Số phát hành) | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 20 | `certificate_book_number` | Số vào sổ cấp GCN | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 21 | `certificate_issue_date` | Ngày cấp Giấy chứng nhận | date | không | 2. Thông tin thửa đất / Bất động sản | YYYY-MM-DD | Không ở tương lai |
| 22 | `certificate_issue_agency` | Cơ quan cấp GCN | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 23 | `mortgage_party_name` | Bên nhận thế chấp (Ngân hàng / Tổ chức tín dụng) | text | có | 3. Thông tin biện pháp bảo đảm / thế chấp | — | — |
| 24 | `mortgage_party_address` | Địa chỉ bên nhận thế chấp | textarea | có | 3. Thông tin biện pháp bảo đảm / thế chấp | — | — |
| 25 | `mortgage_contract_number` | Số Hợp đồng thế chấp | text | có | 3. Thông tin biện pháp bảo đảm / thế chấp | — | — |
| 26 | `mortgage_contract_date` | Ngày ký Hợp đồng thế chấp | date | có | 3. Thông tin biện pháp bảo đảm / thế chấp | YYYY-MM-DD | — |
| 27 | `secured_obligation_amount` | Giá trị nghĩa vụ được bảo đảm (VNĐ) | number | có | 3. Thông tin biện pháp bảo đảm / thế chấp | phải là số | Số kiểu VN (85,5 / 1.250.000) |

</details>

<details><summary><b>DD-011</b> · Thủ tục xóa đăng ký thế chấp quyền sử dụng đất (Giải chấp Sổ đỏ) (25 thẻ)</summary>

| # | Key | Nhãn | Kiểu | Bắt buộc | Nhóm | Kiểm tra BE | Quy tắc FE |
|---:|---|---|---|---|---|---|---|
| 1 | `applicant_name` | Họ và tên người làm đơn | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 2 | `applicant_gender` | Giới tính | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 3 | `applicant_dob` | Ngày tháng năm sinh | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không ở tương lai |
| 4 | `applicant_id_type` | Loại giấy tờ định danh | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 5 | `applicant_id_number` | Số CCCD/Định danh cá nhân | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{9,12}$` | CCCD (12 số; CMND 9/12) |
| 6 | `applicant_id_issue_date` | Ngày cấp CCCD | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không tương lai, ≥ ngày sinh |
| 7 | `applicant_id_issue_place` | Nơi cấp | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 8 | `applicant_phone` | Số điện thoại liên hệ | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{10,11}$` | SĐT VN (chuẩn hóa +84) |
| 9 | `applicant_email` | Địa chỉ email | text | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | Email |
| 10 | `applicant_permanent_address` | Nơi đăng ký thường trú | textarea | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 11 | `applicant_current_address` | Nơi ở hiện nay | textarea | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 12 | `plot_number` | Thửa đất số | text | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 13 | `map_sheet_number` | Tờ bản đồ số | text | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 14 | `land_address` | Địa chỉ thửa đất | textarea | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 15 | `land_area` | Diện tích thửa đất (m²) | number | có | 2. Thông tin thửa đất / Bất động sản | phải là số | Số kiểu VN (85,5 / 1.250.000) |
| 16 | `land_use_purpose` | Mục đích sử dụng đất | select | có | 2. Thông tin thửa đất / Bất động sản | chọn trong 7 mục | — |
| 17 | `land_use_term` | Thời hạn sử dụng đất | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 18 | `land_use_origin` | Nguồn gốc sử dụng đất | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 19 | `certificate_number` | Số seri Giấy chứng nhận (Số phát hành) | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 20 | `certificate_book_number` | Số vào sổ cấp GCN | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 21 | `certificate_issue_date` | Ngày cấp Giấy chứng nhận | date | không | 2. Thông tin thửa đất / Bất động sản | YYYY-MM-DD | Không ở tương lai |
| 22 | `certificate_issue_agency` | Cơ quan cấp GCN | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 23 | `mortgage_party_name` | Bên nhận thế chấp (Ngân hàng đã giải chấp) | text | có | 3. Thông tin giải chấp / xóa đăng ký | — | — |
| 24 | `mortgage_registration_number` | Số hồ sơ đăng ký thế chấp trước đây | text | có | 3. Thông tin giải chấp / xóa đăng ký | — | — |
| 25 | `mortgage_release_reason` | Lý do xóa đăng ký thế chấp | text | có | 3. Thông tin giải chấp / xóa đăng ký | — | — |

</details>

<details><summary><b>DD-012</b> · Thủ tục cung cấp thông tin, dữ liệu đất đai, trích lục bản đồ địa chính (24 thẻ)</summary>

| # | Key | Nhãn | Kiểu | Bắt buộc | Nhóm | Kiểm tra BE | Quy tắc FE |
|---:|---|---|---|---|---|---|---|
| 1 | `applicant_name` | Họ và tên người làm đơn | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 2 | `applicant_gender` | Giới tính | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 3 | `applicant_dob` | Ngày tháng năm sinh | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không ở tương lai |
| 4 | `applicant_id_type` | Loại giấy tờ định danh | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 5 | `applicant_id_number` | Số CCCD/Định danh cá nhân | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{9,12}$` | CCCD (12 số; CMND 9/12) |
| 6 | `applicant_id_issue_date` | Ngày cấp CCCD | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không tương lai, ≥ ngày sinh |
| 7 | `applicant_id_issue_place` | Nơi cấp | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 8 | `applicant_phone` | Số điện thoại liên hệ | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{10,11}$` | SĐT VN (chuẩn hóa +84) |
| 9 | `applicant_email` | Địa chỉ email | text | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | Email |
| 10 | `applicant_permanent_address` | Nơi đăng ký thường trú | textarea | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 11 | `applicant_current_address` | Nơi ở hiện nay | textarea | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 12 | `plot_number` | Thửa đất số | text | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 13 | `map_sheet_number` | Tờ bản đồ số | text | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 14 | `land_address` | Địa chỉ thửa đất | textarea | có | 2. Thông tin thửa đất / Bất động sản | — | — |
| 15 | `land_area` | Diện tích thửa đất (m²) | number | có | 2. Thông tin thửa đất / Bất động sản | phải là số | Số kiểu VN (85,5 / 1.250.000) |
| 16 | `land_use_purpose` | Mục đích sử dụng đất | select | có | 2. Thông tin thửa đất / Bất động sản | chọn trong 7 mục | — |
| 17 | `land_use_term` | Thời hạn sử dụng đất | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 18 | `land_use_origin` | Nguồn gốc sử dụng đất | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 19 | `certificate_number` | Số seri Giấy chứng nhận (Số phát hành) | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 20 | `certificate_book_number` | Số vào sổ cấp GCN | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 21 | `certificate_issue_date` | Ngày cấp Giấy chứng nhận | date | không | 2. Thông tin thửa đất / Bất động sản | YYYY-MM-DD | Không ở tương lai |
| 22 | `certificate_issue_agency` | Cơ quan cấp GCN | text | không | 2. Thông tin thửa đất / Bất động sản | — | — |
| 23 | `data_request_purpose` | Mục đích yêu cầu khai thác thông tin | textarea | có | 3. Yêu cầu giải quyết thủ tục | — | — |
| 24 | `requested_data_type` | Loại thông tin yêu cầu cung cấp | select | có | 3. Yêu cầu giải quyết thủ tục | chọn trong 3 mục | — |

</details>

<details><summary><b>HKD-001</b> · Đăng ký thành lập hộ kinh doanh (17 thẻ)</summary>

| # | Key | Nhãn | Kiểu | Bắt buộc | Nhóm | Kiểm tra BE | Quy tắc FE |
|---:|---|---|---|---|---|---|---|
| 1 | `applicant_name` | Họ và tên người làm đơn | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 2 | `applicant_gender` | Giới tính | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 3 | `applicant_dob` | Ngày tháng năm sinh | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không ở tương lai |
| 4 | `applicant_id_type` | Loại giấy tờ định danh | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 5 | `applicant_id_number` | Số CCCD/Định danh cá nhân | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{9,12}$` | CCCD (12 số; CMND 9/12) |
| 6 | `applicant_id_issue_date` | Ngày cấp CCCD | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không tương lai, ≥ ngày sinh |
| 7 | `applicant_id_issue_place` | Nơi cấp | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 8 | `applicant_phone` | Số điện thoại liên hệ | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{10,11}$` | SĐT VN (chuẩn hóa +84) |
| 9 | `applicant_email` | Địa chỉ email | text | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | Email |
| 10 | `applicant_permanent_address` | Nơi đăng ký thường trú | textarea | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 11 | `applicant_current_address` | Nơi ở hiện nay | textarea | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 12 | `business_name_vn` | Tên Hộ kinh doanh | text | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 13 | `headquarters_address` | Địa chỉ địa điểm kinh doanh | textarea | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 14 | `headquarters_phone` | Số điện thoại liên hệ | text | có | 2. Thông tin tổ chức / Doanh nghiệp | — | SĐT VN (chuẩn hóa +84) |
| 15 | `charter_capital` | Số vốn kinh doanh (VNĐ) | number | có | 2. Thông tin tổ chức / Doanh nghiệp | phải là số | Số kiểu VN (85,5 / 1.250.000) |
| 16 | `main_business_lines` | Ngành nghề kinh doanh | textarea | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 17 | `total_employees` | Số lượng lao động | number | không | 2. Thông tin tổ chức / Doanh nghiệp | phải là số | Số kiểu VN (85,5 / 1.250.000) |

</details>

<details><summary><b>HKD-002</b> · Thay đổi nội dung đăng ký hộ kinh doanh (16 thẻ)</summary>

| # | Key | Nhãn | Kiểu | Bắt buộc | Nhóm | Kiểm tra BE | Quy tắc FE |
|---:|---|---|---|---|---|---|---|
| 1 | `applicant_name` | Họ và tên người làm đơn | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 2 | `applicant_gender` | Giới tính | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 3 | `applicant_dob` | Ngày tháng năm sinh | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không ở tương lai |
| 4 | `applicant_id_type` | Loại giấy tờ định danh | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 5 | `applicant_id_number` | Số CCCD/Định danh cá nhân | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{9,12}$` | CCCD (12 số; CMND 9/12) |
| 6 | `applicant_id_issue_date` | Ngày cấp CCCD | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không tương lai, ≥ ngày sinh |
| 7 | `applicant_id_issue_place` | Nơi cấp | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 8 | `applicant_phone` | Số điện thoại liên hệ | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{10,11}$` | SĐT VN (chuẩn hóa +84) |
| 9 | `applicant_email` | Địa chỉ email | text | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | Email |
| 10 | `applicant_permanent_address` | Nơi đăng ký thường trú | textarea | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 11 | `applicant_current_address` | Nơi ở hiện nay | textarea | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 12 | `business_name_vn` | Tên Hộ kinh doanh hiện tại | text | có | 3. Thông tin tổ chức / Doanh nghiệp | — | — |
| 13 | `business_code` | Mã số đăng ký Hộ kinh doanh / Mã số thuế | text | có | 3. Thông tin tổ chức / Doanh nghiệp | — | — |
| 14 | `change_items` | Nội dung đăng ký thay đổi | select | có | II. Nội dung biến động | chọn trong 4 mục | — |
| 15 | `change_content_before` | Nội dung trước khi thay đổi | textarea | có | II. Nội dung biến động | — | — |
| 16 | `change_content_after` | Nội dung sau khi thay đổi | textarea | có | II. Nội dung biến động | — | — |

</details>

<details><summary><b>HKD-003</b> · Chấm dứt hoạt động hộ kinh doanh (17 thẻ)</summary>

| # | Key | Nhãn | Kiểu | Bắt buộc | Nhóm | Kiểm tra BE | Quy tắc FE |
|---:|---|---|---|---|---|---|---|
| 1 | `applicant_name` | Họ và tên người làm đơn | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 2 | `applicant_gender` | Giới tính | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 3 | `applicant_dob` | Ngày tháng năm sinh | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không ở tương lai |
| 4 | `applicant_id_type` | Loại giấy tờ định danh | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 5 | `applicant_id_number` | Số CCCD/Định danh cá nhân | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{9,12}$` | CCCD (12 số; CMND 9/12) |
| 6 | `applicant_id_issue_date` | Ngày cấp CCCD | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không tương lai, ≥ ngày sinh |
| 7 | `applicant_id_issue_place` | Nơi cấp | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 8 | `applicant_phone` | Số điện thoại liên hệ | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{10,11}$` | SĐT VN (chuẩn hóa +84) |
| 9 | `applicant_email` | Địa chỉ email | text | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | Email |
| 10 | `applicant_permanent_address` | Nơi đăng ký thường trú | textarea | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 11 | `applicant_current_address` | Nơi ở hiện nay | textarea | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 12 | `business_name_vn` | Tên Hộ kinh doanh chấm dứt | text | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 13 | `business_code` | Mã số đăng ký Hộ kinh doanh / Mã số thuế | text | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 14 | `headquarters_address` | Địa chỉ địa điểm kinh doanh | textarea | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 15 | `termination_reason` | Lý do chấm dứt hoạt động | textarea | có | 3. Thông tin giải thể / chấm dứt hoạt động | — | — |
| 16 | `tax_clearance_status` | Tình trạng nghĩa vụ thuế | select | có | 3. Thông tin giải thể / chấm dứt hoạt động | chọn trong 2 mục | — |
| 17 | `termination_date` | Thời điểm dự kiến chấm dứt hoạt động | date | có | 3. Thông tin giải thể / chấm dứt hoạt động | YYYY-MM-DD | — |

</details>

<details><summary><b>DN-001</b> · Thủ tục ủy quyền thực hiện thủ tục đăng ký doanh nghiệp (25 thẻ)</summary>

| # | Key | Nhãn | Kiểu | Bắt buộc | Nhóm | Kiểm tra BE | Quy tắc FE |
|---:|---|---|---|---|---|---|---|
| 1 | `authorizer_name` | Họ và tên người làm đơn | text | có | 1. Thông tin người ủy quyền | — | — |
| 2 | `authorizer_gender` | Giới tính | select | có | 1. Thông tin người ủy quyền | chọn trong 3 mục | — |
| 3 | `authorizer_dob` | Ngày tháng năm sinh | date | có | 1. Thông tin người ủy quyền | YYYY-MM-DD | Không ở tương lai |
| 4 | `authorizer_id_type` | Loại giấy tờ định danh | select | có | 1. Thông tin người ủy quyền | chọn trong 3 mục | — |
| 5 | `authorizer_id_number` | Số CCCD/Định danh cá nhân | text | có | 1. Thông tin người ủy quyền | regex `^[0-9]{9,12}$` | CCCD (12 số; CMND 9/12) |
| 6 | `authorizer_id_issue_date` | Ngày cấp CCCD | date | có | 1. Thông tin người ủy quyền | YYYY-MM-DD | Không tương lai, ≥ ngày sinh |
| 7 | `authorizer_id_issue_place` | Nơi cấp | text | có | 1. Thông tin người ủy quyền | — | — |
| 8 | `authorizer_phone` | Số điện thoại liên hệ | text | có | 1. Thông tin người ủy quyền | regex `^[0-9]{10,11}$` | SĐT VN (chuẩn hóa +84) |
| 9 | `authorizer_email` | Địa chỉ email | text | không | 1. Thông tin người ủy quyền | — | Email |
| 10 | `authorizer_permanent_address` | Nơi đăng ký thường trú | textarea | có | 1. Thông tin người ủy quyền | — | — |
| 11 | `authorizer_current_address` | Nơi ở hiện nay | textarea | không | 1. Thông tin người ủy quyền | — | — |
| 12 | `authorized_person_name` | Họ và tên người làm đơn | text | có | 2. Thông tin người được ủy quyền | — | — |
| 13 | `authorized_person_gender` | Giới tính | select | có | 2. Thông tin người được ủy quyền | chọn trong 3 mục | — |
| 14 | `authorized_person_dob` | Ngày tháng năm sinh | date | có | 2. Thông tin người được ủy quyền | YYYY-MM-DD | Không ở tương lai |
| 15 | `authorized_person_id_type` | Loại giấy tờ định danh | select | có | 2. Thông tin người được ủy quyền | chọn trong 3 mục | — |
| 16 | `authorized_person_id_number` | Số CCCD/Định danh cá nhân | text | có | 2. Thông tin người được ủy quyền | regex `^[0-9]{9,12}$` | CCCD (12 số; CMND 9/12) |
| 17 | `authorized_person_id_issue_date` | Ngày cấp CCCD | date | có | 2. Thông tin người được ủy quyền | YYYY-MM-DD | Không tương lai, ≥ ngày sinh |
| 18 | `authorized_person_id_issue_place` | Nơi cấp | text | có | 2. Thông tin người được ủy quyền | — | — |
| 19 | `authorized_person_phone` | Số điện thoại liên hệ | text | có | 2. Thông tin người được ủy quyền | regex `^[0-9]{10,11}$` | SĐT VN (chuẩn hóa +84) |
| 20 | `authorized_person_email` | Địa chỉ email | text | không | 2. Thông tin người được ủy quyền | — | Email |
| 21 | `authorized_person_permanent_address` | Nơi đăng ký thường trú | textarea | có | 2. Thông tin người được ủy quyền | — | — |
| 22 | `authorized_person_current_address` | Nơi ở hiện nay | textarea | không | 2. Thông tin người được ủy quyền | — | — |
| 23 | `business_name_vn` | Tên Doanh nghiệp thực hiện thủ tục | text | có | 3. Phạm vi và thời hạn ủy quyền | — | — |
| 24 | `authorization_scope` | Phạm vi ủy quyền | textarea | có | 3. Phạm vi và thời hạn ủy quyền | — | — |
| 25 | `authorization_term` | Thời hạn ủy quyền | text | có | 3. Phạm vi và thời hạn ủy quyền | — | — |

</details>

<details><summary><b>DN-002</b> · Thủ tục đề nghị cấp lại Giấy chứng nhận đăng ký doanh nghiệp (14 thẻ)</summary>

| # | Key | Nhãn | Kiểu | Bắt buộc | Nhóm | Kiểm tra BE | Quy tắc FE |
|---:|---|---|---|---|---|---|---|
| 1 | `applicant_name` | Họ và tên người làm đơn | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 2 | `applicant_gender` | Giới tính | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 3 | `applicant_dob` | Ngày tháng năm sinh | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không ở tương lai |
| 4 | `applicant_id_type` | Loại giấy tờ định danh | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 5 | `applicant_id_number` | Số CCCD/Định danh cá nhân | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{9,12}$` | CCCD (12 số; CMND 9/12) |
| 6 | `applicant_id_issue_date` | Ngày cấp CCCD | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không tương lai, ≥ ngày sinh |
| 7 | `applicant_id_issue_place` | Nơi cấp | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 8 | `applicant_phone` | Số điện thoại liên hệ | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{10,11}$` | SĐT VN (chuẩn hóa +84) |
| 9 | `applicant_email` | Địa chỉ email | text | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | Email |
| 10 | `applicant_permanent_address` | Nơi đăng ký thường trú | textarea | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 11 | `applicant_current_address` | Nơi ở hiện nay | textarea | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 12 | `business_name_vn` | Tên Doanh nghiệp | text | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 13 | `business_code` | Mã số doanh nghiệp / Mã số thuế | text | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 14 | `reissue_reason` | Lý do đề nghị cấp lại Giấy chứng nhận | select | có | 3. Yêu cầu giải quyết thủ tục | chọn trong 2 mục | — |

</details>

<details><summary><b>DN-003</b> · Thủ tục đăng ký thành lập Công ty Cổ phần (25 thẻ)</summary>

| # | Key | Nhãn | Kiểu | Bắt buộc | Nhóm | Kiểm tra BE | Quy tắc FE |
|---:|---|---|---|---|---|---|---|
| 1 | `applicant_name` | Họ và tên người làm đơn | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 2 | `applicant_gender` | Giới tính | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 3 | `applicant_dob` | Ngày tháng năm sinh | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không ở tương lai |
| 4 | `applicant_id_type` | Loại giấy tờ định danh | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 5 | `applicant_id_number` | Số CCCD/Định danh cá nhân | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{9,12}$` | CCCD (12 số; CMND 9/12) |
| 6 | `applicant_id_issue_date` | Ngày cấp CCCD | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không tương lai, ≥ ngày sinh |
| 7 | `applicant_id_issue_place` | Nơi cấp | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 8 | `applicant_phone` | Số điện thoại liên hệ | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{10,11}$` | SĐT VN (chuẩn hóa +84) |
| 9 | `applicant_email` | Địa chỉ email | text | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | Email |
| 10 | `applicant_permanent_address` | Nơi đăng ký thường trú | textarea | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 11 | `applicant_current_address` | Nơi ở hiện nay | textarea | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 12 | `business_name_vn` | Tên tiếng Việt | text | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 13 | `business_name_en` | Tên tiếng nước ngoài (nếu có) | text | không | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 14 | `business_name_abbr` | Tên viết tắt (nếu có) | text | không | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 15 | `headquarters_address` | Địa chỉ trụ sở chính | textarea | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 16 | `headquarters_phone` | Điện thoại trụ sở | text | có | 2. Thông tin tổ chức / Doanh nghiệp | — | SĐT VN (chuẩn hóa +84) |
| 17 | `headquarters_email` | Email trụ sở | text | không | 2. Thông tin tổ chức / Doanh nghiệp | — | Email |
| 18 | `charter_capital` | Vốn điều lệ / Vốn kinh doanh (VNĐ) | number | có | 2. Thông tin tổ chức / Doanh nghiệp | phải là số | Số kiểu VN (85,5 / 1.250.000) |
| 19 | `charter_capital_in_words` | Vốn điều lệ bằng chữ | text | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 20 | `main_business_lines` | Ngành nghề kinh doanh chính | textarea | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 21 | `total_employees` | Quy mô số lao động dự kiến | number | không | 2. Thông tin tổ chức / Doanh nghiệp | phải là số | Số kiểu VN (85,5 / 1.250.000) |
| 22 | `founding_shareholders_count` | Số lượng cổ đông sáng lập (tối thiểu 03) | number | có | 3. Cơ cấu quản lý & Người đại diện | phải là số | Số kiểu VN (85,5 / 1.250.000) |
| 23 | `total_shares` | Tổng số cổ phần đăng ký chào bán | number | có | 3. Cơ cấu quản lý & Người đại diện | phải là số | Số kiểu VN (85,5 / 1.250.000) |
| 24 | `par_value_per_share` | Mệnh giá mỗi cổ phần (VNĐ) | number | có | 3. Cơ cấu quản lý & Người đại diện | phải là số | Số kiểu VN (85,5 / 1.250.000) |
| 25 | `legal_representative_title` | Chức danh người đại diện theo pháp luật | select | có | 3. Cơ cấu quản lý & Người đại diện | chọn trong 3 mục | — |

</details>

<details><summary><b>DN-004</b> · Thủ tục đăng ký thành lập Công ty Trách nhiệm hữu hạn (23 thẻ)</summary>

| # | Key | Nhãn | Kiểu | Bắt buộc | Nhóm | Kiểm tra BE | Quy tắc FE |
|---:|---|---|---|---|---|---|---|
| 1 | `applicant_name` | Họ và tên người làm đơn | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 2 | `applicant_gender` | Giới tính | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 3 | `applicant_dob` | Ngày tháng năm sinh | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không ở tương lai |
| 4 | `applicant_id_type` | Loại giấy tờ định danh | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 5 | `applicant_id_number` | Số CCCD/Định danh cá nhân | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{9,12}$` | CCCD (12 số; CMND 9/12) |
| 6 | `applicant_id_issue_date` | Ngày cấp CCCD | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không tương lai, ≥ ngày sinh |
| 7 | `applicant_id_issue_place` | Nơi cấp | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 8 | `applicant_phone` | Số điện thoại liên hệ | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{10,11}$` | SĐT VN (chuẩn hóa +84) |
| 9 | `applicant_email` | Địa chỉ email | text | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | Email |
| 10 | `applicant_permanent_address` | Nơi đăng ký thường trú | textarea | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 11 | `applicant_current_address` | Nơi ở hiện nay | textarea | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 12 | `business_name_vn` | Tên tiếng Việt | text | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 13 | `business_name_en` | Tên tiếng nước ngoài (nếu có) | text | không | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 14 | `business_name_abbr` | Tên viết tắt (nếu có) | text | không | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 15 | `headquarters_address` | Địa chỉ trụ sở chính | textarea | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 16 | `headquarters_phone` | Điện thoại trụ sở | text | có | 2. Thông tin tổ chức / Doanh nghiệp | — | SĐT VN (chuẩn hóa +84) |
| 17 | `headquarters_email` | Email trụ sở | text | không | 2. Thông tin tổ chức / Doanh nghiệp | — | Email |
| 18 | `charter_capital` | Vốn điều lệ / Vốn kinh doanh (VNĐ) | number | có | 2. Thông tin tổ chức / Doanh nghiệp | phải là số | Số kiểu VN (85,5 / 1.250.000) |
| 19 | `charter_capital_in_words` | Vốn điều lệ bằng chữ | text | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 20 | `main_business_lines` | Ngành nghề kinh doanh chính | textarea | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 21 | `total_employees` | Quy mô số lao động dự kiến | number | không | 2. Thông tin tổ chức / Doanh nghiệp | phải là số | Số kiểu VN (85,5 / 1.250.000) |
| 22 | `llc_type` | Loại hình Công ty TNHH | select | có | 3. Cơ cấu quản lý & Người đại diện | chọn trong 2 mục | — |
| 23 | `legal_representative_title` | Chức danh người đại diện theo pháp luật | select | có | 3. Cơ cấu quản lý & Người đại diện | chọn trong 3 mục | — |

</details>

<details><summary><b>DN-005</b> · Thủ tục đăng ký thành lập Doanh nghiệp tư nhân (22 thẻ)</summary>

| # | Key | Nhãn | Kiểu | Bắt buộc | Nhóm | Kiểm tra BE | Quy tắc FE |
|---:|---|---|---|---|---|---|---|
| 1 | `applicant_name` | Họ và tên người làm đơn | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 2 | `applicant_gender` | Giới tính | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 3 | `applicant_dob` | Ngày tháng năm sinh | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không ở tương lai |
| 4 | `applicant_id_type` | Loại giấy tờ định danh | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 5 | `applicant_id_number` | Số CCCD/Định danh cá nhân | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{9,12}$` | CCCD (12 số; CMND 9/12) |
| 6 | `applicant_id_issue_date` | Ngày cấp CCCD | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không tương lai, ≥ ngày sinh |
| 7 | `applicant_id_issue_place` | Nơi cấp | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 8 | `applicant_phone` | Số điện thoại liên hệ | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{10,11}$` | SĐT VN (chuẩn hóa +84) |
| 9 | `applicant_email` | Địa chỉ email | text | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | Email |
| 10 | `applicant_permanent_address` | Nơi đăng ký thường trú | textarea | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 11 | `applicant_current_address` | Nơi ở hiện nay | textarea | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 12 | `business_name_vn` | Tên tiếng Việt | text | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 13 | `business_name_en` | Tên tiếng nước ngoài (nếu có) | text | không | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 14 | `business_name_abbr` | Tên viết tắt (nếu có) | text | không | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 15 | `headquarters_address` | Địa chỉ trụ sở chính | textarea | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 16 | `headquarters_phone` | Điện thoại trụ sở | text | có | 2. Thông tin tổ chức / Doanh nghiệp | — | SĐT VN (chuẩn hóa +84) |
| 17 | `headquarters_email` | Email trụ sở | text | không | 2. Thông tin tổ chức / Doanh nghiệp | — | Email |
| 18 | `charter_capital` | Vốn điều lệ / Vốn kinh doanh (VNĐ) | number | có | 2. Thông tin tổ chức / Doanh nghiệp | phải là số | Số kiểu VN (85,5 / 1.250.000) |
| 19 | `charter_capital_in_words` | Vốn điều lệ bằng chữ | text | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 20 | `main_business_lines` | Ngành nghề kinh doanh chính | textarea | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 21 | `total_employees` | Quy mô số lao động dự kiến | number | không | 2. Thông tin tổ chức / Doanh nghiệp | phải là số | Số kiểu VN (85,5 / 1.250.000) |
| 22 | `owner_commitment` | Cam kết trách nhiệm tài sản của chủ DNTN | checkbox | có | 2. Thông tin tổ chức / Doanh nghiệp | true/false | — |

</details>

<details><summary><b>DN-006</b> · Thủ tục thuê nhà/mặt bằng làm Trụ sở chính doanh nghiệp (27 thẻ)</summary>

| # | Key | Nhãn | Kiểu | Bắt buộc | Nhóm | Kiểm tra BE | Quy tắc FE |
|---:|---|---|---|---|---|---|---|
| 1 | `lessor_name` | Họ và tên người làm đơn | text | có | 1. Thông tin bên cho thuê | — | — |
| 2 | `lessor_gender` | Giới tính | select | có | 1. Thông tin bên cho thuê | chọn trong 3 mục | — |
| 3 | `lessor_dob` | Ngày tháng năm sinh | date | có | 1. Thông tin bên cho thuê | YYYY-MM-DD | Không ở tương lai |
| 4 | `lessor_id_type` | Loại giấy tờ định danh | select | có | 1. Thông tin bên cho thuê | chọn trong 3 mục | — |
| 5 | `lessor_id_number` | Số CCCD/Định danh cá nhân | text | có | 1. Thông tin bên cho thuê | regex `^[0-9]{9,12}$` | CCCD (12 số; CMND 9/12) |
| 6 | `lessor_id_issue_date` | Ngày cấp CCCD | date | có | 1. Thông tin bên cho thuê | YYYY-MM-DD | Không tương lai, ≥ ngày sinh |
| 7 | `lessor_id_issue_place` | Nơi cấp | text | có | 1. Thông tin bên cho thuê | — | — |
| 8 | `lessor_phone` | Số điện thoại liên hệ | text | có | 1. Thông tin bên cho thuê | regex `^[0-9]{10,11}$` | SĐT VN (chuẩn hóa +84) |
| 9 | `lessor_email` | Địa chỉ email | text | không | 1. Thông tin bên cho thuê | — | Email |
| 10 | `lessor_permanent_address` | Nơi đăng ký thường trú | textarea | có | 1. Thông tin bên cho thuê | — | — |
| 11 | `lessor_current_address` | Nơi ở hiện nay | textarea | không | 1. Thông tin bên cho thuê | — | — |
| 12 | `lessee_name` | Họ và tên người làm đơn | text | có | 2. Thông tin bên thuê | — | — |
| 13 | `lessee_gender` | Giới tính | select | có | 2. Thông tin bên thuê | chọn trong 3 mục | — |
| 14 | `lessee_dob` | Ngày tháng năm sinh | date | có | 2. Thông tin bên thuê | YYYY-MM-DD | Không ở tương lai |
| 15 | `lessee_id_type` | Loại giấy tờ định danh | select | có | 2. Thông tin bên thuê | chọn trong 3 mục | — |
| 16 | `lessee_id_number` | Số CCCD/Định danh cá nhân | text | có | 2. Thông tin bên thuê | regex `^[0-9]{9,12}$` | CCCD (12 số; CMND 9/12) |
| 17 | `lessee_id_issue_date` | Ngày cấp CCCD | date | có | 2. Thông tin bên thuê | YYYY-MM-DD | Không tương lai, ≥ ngày sinh |
| 18 | `lessee_id_issue_place` | Nơi cấp | text | có | 2. Thông tin bên thuê | — | — |
| 19 | `lessee_phone` | Số điện thoại liên hệ | text | có | 2. Thông tin bên thuê | regex `^[0-9]{10,11}$` | SĐT VN (chuẩn hóa +84) |
| 20 | `lessee_email` | Địa chỉ email | text | không | 2. Thông tin bên thuê | — | Email |
| 21 | `lessee_permanent_address` | Nơi đăng ký thường trú | textarea | có | 2. Thông tin bên thuê | — | — |
| 22 | `lessee_current_address` | Nơi ở hiện nay | textarea | không | 2. Thông tin bên thuê | — | — |
| 23 | `rental_address` | Địa chỉ mặt bằng / văn phòng cho thuê | textarea | có | 3. Thông tin thửa đất / Bất động sản | — | — |
| 24 | `rental_area` | Diện tích thuê (m²) | number | có | 3. Thông tin thửa đất / Bất động sản | phải là số | Số kiểu VN (85,5 / 1.250.000) |
| 25 | `rental_price` | Giá thuê hàng tháng (VNĐ) | number | có | 4. Điều khoản thanh toán & Giá thuê | phải là số | Số kiểu VN (85,5 / 1.250.000) |
| 26 | `rental_deposit` | Tiền đặt cọc (VNĐ) | number | có | 4. Điều khoản thanh toán & Giá thuê | phải là số | Số kiểu VN (85,5 / 1.250.000) |
| 27 | `rental_term_months` | Thời hạn thuê (số tháng) | number | có | 4. Điều khoản thanh toán & Giá thuê | phải là số | Số kiểu VN (85,5 / 1.250.000) |

</details>

<details><summary><b>DN-007</b> · Thủ tục đăng ký thuế, khai thuế ban đầu (16 thẻ)</summary>

| # | Key | Nhãn | Kiểu | Bắt buộc | Nhóm | Kiểm tra BE | Quy tắc FE |
|---:|---|---|---|---|---|---|---|
| 1 | `applicant_name` | Họ và tên người làm đơn | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 2 | `applicant_gender` | Giới tính | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 3 | `applicant_dob` | Ngày tháng năm sinh | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không ở tương lai |
| 4 | `applicant_id_type` | Loại giấy tờ định danh | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 5 | `applicant_id_number` | Số CCCD/Định danh cá nhân | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{9,12}$` | CCCD (12 số; CMND 9/12) |
| 6 | `applicant_id_issue_date` | Ngày cấp CCCD | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không tương lai, ≥ ngày sinh |
| 7 | `applicant_id_issue_place` | Nơi cấp | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 8 | `applicant_phone` | Số điện thoại liên hệ | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{10,11}$` | SĐT VN (chuẩn hóa +84) |
| 9 | `applicant_email` | Địa chỉ email | text | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | Email |
| 10 | `applicant_permanent_address` | Nơi đăng ký thường trú | textarea | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 11 | `applicant_current_address` | Nơi ở hiện nay | textarea | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 12 | `business_name_vn` | Tên người nộp thuế (Doanh nghiệp) | text | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 13 | `business_code` | Mã số thuế | text | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 14 | `tax_accounting_method` | Chế độ kế toán áp dụng | select | có | 3. Thông tin đăng ký và kê khai thuế | chọn trong 2 mục | — |
| 15 | `vat_calculation_method` | Phương pháp tính thuế GTGT | select | có | 3. Thông tin đăng ký và kê khai thuế | chọn trong 2 mục | — |
| 16 | `fiscal_year_start` | Ngày bắt đầu năm tài chính | text | có | 3. Thông tin đăng ký và kê khai thuế | — | — |

</details>

<details><summary><b>DN-008</b> · Thủ tục đăng ký thành lập Công ty Hợp danh (22 thẻ)</summary>

| # | Key | Nhãn | Kiểu | Bắt buộc | Nhóm | Kiểm tra BE | Quy tắc FE |
|---:|---|---|---|---|---|---|---|
| 1 | `applicant_name` | Họ và tên người làm đơn | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 2 | `applicant_gender` | Giới tính | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 3 | `applicant_dob` | Ngày tháng năm sinh | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không ở tương lai |
| 4 | `applicant_id_type` | Loại giấy tờ định danh | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 5 | `applicant_id_number` | Số CCCD/Định danh cá nhân | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{9,12}$` | CCCD (12 số; CMND 9/12) |
| 6 | `applicant_id_issue_date` | Ngày cấp CCCD | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không tương lai, ≥ ngày sinh |
| 7 | `applicant_id_issue_place` | Nơi cấp | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 8 | `applicant_phone` | Số điện thoại liên hệ | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{10,11}$` | SĐT VN (chuẩn hóa +84) |
| 9 | `applicant_email` | Địa chỉ email | text | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | Email |
| 10 | `applicant_permanent_address` | Nơi đăng ký thường trú | textarea | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 11 | `applicant_current_address` | Nơi ở hiện nay | textarea | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 12 | `business_name_vn` | Tên tiếng Việt | text | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 13 | `business_name_en` | Tên tiếng nước ngoài (nếu có) | text | không | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 14 | `business_name_abbr` | Tên viết tắt (nếu có) | text | không | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 15 | `headquarters_address` | Địa chỉ trụ sở chính | textarea | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 16 | `headquarters_phone` | Điện thoại trụ sở | text | có | 2. Thông tin tổ chức / Doanh nghiệp | — | SĐT VN (chuẩn hóa +84) |
| 17 | `headquarters_email` | Email trụ sở | text | không | 2. Thông tin tổ chức / Doanh nghiệp | — | Email |
| 18 | `charter_capital` | Vốn điều lệ / Vốn kinh doanh (VNĐ) | number | có | 2. Thông tin tổ chức / Doanh nghiệp | phải là số | Số kiểu VN (85,5 / 1.250.000) |
| 19 | `charter_capital_in_words` | Vốn điều lệ bằng chữ | text | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 20 | `main_business_lines` | Ngành nghề kinh doanh chính | textarea | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 21 | `total_employees` | Quy mô số lao động dự kiến | number | không | 2. Thông tin tổ chức / Doanh nghiệp | phải là số | Số kiểu VN (85,5 / 1.250.000) |
| 22 | `general_partners_count` | Số lượng thành viên hợp danh (tối thiểu 02 cá nhân) | number | có | 3. Cơ cấu quản lý & Người đại diện | phải là số | Số kiểu VN (85,5 / 1.250.000) |

</details>

<details><summary><b>DN-009</b> · Thủ tục đăng ký giải thể doanh nghiệp (15 thẻ)</summary>

| # | Key | Nhãn | Kiểu | Bắt buộc | Nhóm | Kiểm tra BE | Quy tắc FE |
|---:|---|---|---|---|---|---|---|
| 1 | `applicant_name` | Họ và tên người làm đơn | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 2 | `applicant_gender` | Giới tính | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 3 | `applicant_dob` | Ngày tháng năm sinh | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không ở tương lai |
| 4 | `applicant_id_type` | Loại giấy tờ định danh | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 5 | `applicant_id_number` | Số CCCD/Định danh cá nhân | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{9,12}$` | CCCD (12 số; CMND 9/12) |
| 6 | `applicant_id_issue_date` | Ngày cấp CCCD | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không tương lai, ≥ ngày sinh |
| 7 | `applicant_id_issue_place` | Nơi cấp | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 8 | `applicant_phone` | Số điện thoại liên hệ | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{10,11}$` | SĐT VN (chuẩn hóa +84) |
| 9 | `applicant_email` | Địa chỉ email | text | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | Email |
| 10 | `applicant_permanent_address` | Nơi đăng ký thường trú | textarea | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 11 | `applicant_current_address` | Nơi ở hiện nay | textarea | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 12 | `business_name_vn` | Tên Doanh nghiệp giải thể | text | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 13 | `business_code` | Mã số thuế / Mã số doanh nghiệp | text | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 14 | `dissolution_reason` | Lý do giải thể | textarea | có | 3. Thông tin giải thể / chấm dứt hoạt động | — | — |
| 15 | `debt_settlement_commitment` | Cam kết thanh toán toàn bộ nợ và nghĩa vụ tài sản | checkbox | có | 3. Thông tin giải thể / chấm dứt hoạt động | true/false | — |

</details>

<details><summary><b>DN-010</b> · Thủ tục thông báo tạm ngừng / Cấp đổi thông tin ĐKDN (16 thẻ)</summary>

| # | Key | Nhãn | Kiểu | Bắt buộc | Nhóm | Kiểm tra BE | Quy tắc FE |
|---:|---|---|---|---|---|---|---|
| 1 | `applicant_name` | Họ và tên người làm đơn | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 2 | `applicant_gender` | Giới tính | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 3 | `applicant_dob` | Ngày tháng năm sinh | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không ở tương lai |
| 4 | `applicant_id_type` | Loại giấy tờ định danh | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 5 | `applicant_id_number` | Số CCCD/Định danh cá nhân | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{9,12}$` | CCCD (12 số; CMND 9/12) |
| 6 | `applicant_id_issue_date` | Ngày cấp CCCD | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không tương lai, ≥ ngày sinh |
| 7 | `applicant_id_issue_place` | Nơi cấp | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 8 | `applicant_phone` | Số điện thoại liên hệ | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{10,11}$` | SĐT VN (chuẩn hóa +84) |
| 9 | `applicant_email` | Địa chỉ email | text | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | Email |
| 10 | `applicant_permanent_address` | Nơi đăng ký thường trú | textarea | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 11 | `applicant_current_address` | Nơi ở hiện nay | textarea | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 12 | `business_name_vn` | Tên Doanh nghiệp | text | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 13 | `business_code` | Mã số doanh nghiệp | text | có | 2. Thông tin tổ chức / Doanh nghiệp | — | — |
| 14 | `suspension_from_date` | Ngày bắt đầu tạm ngừng kinh doanh | date | có | 3. Thông tin tạm ngừng hoạt động | YYYY-MM-DD | — |
| 15 | `suspension_to_date` | Ngày kết thúc tạm ngừng kinh doanh | date | có | 3. Thông tin tạm ngừng hoạt động | YYYY-MM-DD | — |
| 16 | `suspension_reason` | Lý do tạm ngừng kinh doanh | textarea | có | 3. Thông tin tạm ngừng hoạt động | — | — |

</details>

<details><summary><b>DN-011</b> · Thủ tục đăng ký thay đổi nội dung Đăng ký doanh nghiệp (16 thẻ)</summary>

| # | Key | Nhãn | Kiểu | Bắt buộc | Nhóm | Kiểm tra BE | Quy tắc FE |
|---:|---|---|---|---|---|---|---|
| 1 | `applicant_name` | Họ và tên người làm đơn | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 2 | `applicant_gender` | Giới tính | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 3 | `applicant_dob` | Ngày tháng năm sinh | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không ở tương lai |
| 4 | `applicant_id_type` | Loại giấy tờ định danh | select | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | chọn trong 3 mục | — |
| 5 | `applicant_id_number` | Số CCCD/Định danh cá nhân | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{9,12}$` | CCCD (12 số; CMND 9/12) |
| 6 | `applicant_id_issue_date` | Ngày cấp CCCD | date | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | YYYY-MM-DD | Không tương lai, ≥ ngày sinh |
| 7 | `applicant_id_issue_place` | Nơi cấp | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 8 | `applicant_phone` | Số điện thoại liên hệ | text | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | regex `^[0-9]{10,11}$` | SĐT VN (chuẩn hóa +84) |
| 9 | `applicant_email` | Địa chỉ email | text | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | Email |
| 10 | `applicant_permanent_address` | Nơi đăng ký thường trú | textarea | có | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 11 | `applicant_current_address` | Nơi ở hiện nay | textarea | không | I. Người sử dụng đất, chủ sở hữu tài sản gắn liền với đất | — | — |
| 12 | `business_name_vn` | Tên Doanh nghiệp hiện tại | text | có | 3. Thông tin tổ chức / Doanh nghiệp | — | — |
| 13 | `business_code` | Mã số doanh nghiệp | text | có | 3. Thông tin tổ chức / Doanh nghiệp | — | — |
| 14 | `change_items` | Nội dung đăng ký thay đổi | select | có | II. Nội dung biến động | chọn trong 5 mục | — |
| 15 | `change_content_before` | Nội dung trước khi thay đổi | textarea | có | II. Nội dung biến động | — | — |
| 16 | `change_content_after` | Nội dung sau khi thay đổi | textarea | có | II. Nội dung biến động | — | — |

</details>

### Bộ thẻ mặc định ở khung admin (admin-template-drawer.js)

| Đất đai | Hộ kinh doanh |
|---|---|
| Họ và tên người sử dụng đất (text, *) | Tên hộ kinh doanh (text, *) |
| Số CCCD (**cccd**, *) | Họ tên chủ hộ (text, *) |
| Địa chỉ thửa đất (textarea, *) | Số CCCD (**cccd**, *) |
| Số thửa (text, *) | Địa chỉ kinh doanh (textarea, *) |
| Số tờ bản đồ (text, *) | Ngành nghề (text, *) |
| Diện tích (m²) (number, *) | Vốn kinh doanh (number) |
