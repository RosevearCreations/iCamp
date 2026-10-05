# iCamp Requirements Coverage Matrix

This matrix cross-checks the complete iCamp vision against the restarted active roadmap.

| Requirement | Active build coverage |
| --- | --- |
| Responsive phone/tablet/computer/PWA | 001, 147 |
| IVR/telephone/numeric keypad/DTMF | 001, 009-015, then channel parity in every applicable build |
| SMS/MMS and text commands | 009-015, then channel parity in every applicable build |
| Voice/speech input and staff transfer | 010-015 |
| SMS consent/STOP/START/HELP/compliance | 014, 103, 151 |
| Secure telephony identity; caller ID not authentication | 013, 149 |
| Secure telephone payment handoff | 013, 042, 149 |
| Environment/configuration/health | 002 |
| I.T./Analysis workspace and troubleshooting | 002, 007, 148-150, 153 |
| Lockup/non-response detection via external watchdog | 002, 153 |
| Sanitized global client system-status web interface | 002, 149, 153 |
| Request/correlation IDs and safe support references | 002, 006, 148 |
| Error/integration/queue health analysis | 002, 007, 148, 153 |
| Database/migrations/multi-property foundation | 003, 152 |
| Authentication/sessions/MFA readiness | 004 |
| Roles, granular permissions and RLS | 005-006 |
| Audit and privileged action controls | 006 |
| Recurring scheduler/background jobs | 007, 068 |
| Secure media/document storage | 008, 028, 144 |
| Real overhead/drone/site-plan image | 018 |
| Zoom/pan with accurate clickable overlays | 019-021 |
| Irregular polygon plotting | 020-023 |
| Booking/maintenance/security/map layers | 022 |
| Campsite types: tent/RV/serviced/unserviced/etc. | 025 |
| Rustic and serviced rental cottages | 026-027 |
| Cottage kitchens/washrooms/features | 026 |
| Cottage same live reservation engine as campsites | 024, 034-044 |
| Up to 10 public images for each campsite/cottage | 028, 038 |
| Pools, water parks, washrooms, ball fields as operational assets | 029, 070-073 |
| Green/grey/yellow/red status | 030, 037 |
| Management closures/blocks/map publication | 031 |
| Booking calendar/date rules | 032 |
| Adjustable occupants/visitors/vehicles by site | 033, 055 |
| Site/cottage compatibility | 034 |
| Live availability | 035 |
| Atomic temporary booking holds | 036 |
| Public interactive booking map | 037-038 |
| Rates, cottage rates, deposits, payments | 039-045 |
| Add-ons/fees/passes | 040 |
| Walk-up/office booking | 046 |
| Seasonal/yearly sites | 047, 087-089 |
| Guest profile/front desk/check-in/out | 048-052 |
| Road vehicles registered to campsite/cottage/pass | 053-054 |
| Visitor registration and limits | 055 |
| Key card/fob/keypad/QR/wristband access | 056, 062-063 |
| Gate/barrier registry and live state | 057-058 |
| Manual gate open/close override | 059 |
| Access zones/schedules/rules | 060 |
| Security incidents/dashboard | 061, 064 |
| Maintenance categories/work orders/roles | 065-067 |
| Hourly/daily/weekly/monthly/seasonal maintenance | 068 |
| Inspection templates/sign-offs | 069 |
| Pool/water-park maintenance | 070 |
| Washroom/shower/laundry upkeep | 071 |
| Baseball/sports/playground/hall maintenance | 072 |
| Roads/utilities/garbage/septic maintenance | 073 |
| Departure campsite cleanup | 074 |
| Cottage housekeeping/turnover | 075 |
| Preventive maintenance | 076 |
| Offline field maintenance | 077 |
| Camper assistance/problems/severity | 078-079 |
| Garbage bins/site pickup/scheduled/paid collection | 080 |
| Paid garbage stickers/tags | 081, 123 |
| Versioned campground/facility rules | 082 |
| Warnings/suspensions/reinstatement | 083 |
| Lifeguarded pool/swimming enforcement | 084 |
| Lake/ocean/beach swimming rules | 085 |
| Emergency communication | 086 |
| Yearly-site winterization/sign-off | 087 |
| Cold-weather insulation/readiness evidence | 088 |
| Spring reopening sign-off | 089 |
| Permanent unit separate from site | 090 |
| Permanent-unit listings/inquiries/sales/transfers | 091-092 |
| Office financing intake/provider boundary | 093-094 |
| Golf cart/e-bike/device registration | 095 |
| Device safety checks/authorization | 096 |
| Friday dances/Halloween/live events | 097 |
| Free/paid event tickets/passes | 098-099 |
| Local attractions such as fairs/truck shows | 100-101 |
| Promote local interests through customer interactions | 102, 106 |
| Marketing preference/consent | 103 |
| Promotion performance/freshness | 104 |
| Guest reviews/moderation | 105 |
| Lake/river/ocean/beach model | 107 |
| Boat registration | 108 |
| Boat launch/day-use fee | 109 |
| Docks/slips and assignment | 110-111 |
| Pedal boats/canoes/kayaks/etc. rentals | 112-116 |
| Campground store/products/suppliers | 117 |
| Inventory | 118, 124 |
| POS | 119-120, 125 |
| Online store | 121 |
| Campsite/cottage delivery/pickup toggle | 122 |
| Firewood/ice/propane/passes/service items | 123 |
| Campsite account charges | 126 |
| Staff directory/roles/departments | 127 |
| Employee scheduling/timekeeping | 128-129 |
| Training/qualifications | 130 |
| Vendors/contracts | 131 |
| Garbage/septic/ISP recurring contractors | 132 |
| Accounts payable | 133 |
| Revenue/expense accounting | 134-142 |
| Profit/loss and profitability | 136, 141 |
| Management operations dashboard | 138 |
| Global search | 143 |
| Document management | 144 |
| Universal timeline | 145 |
| Reports/evidence/exports | 146 |
| Accessibility/device certification including phone channels | 147 |
| Performance/query/realtime scale | 148 |
| Abuse/security hardening | 149 |
| Backup/restore/disaster recovery | 150 |
| Privacy/retention/export/deletion | 151 |
| Multi-campground isolation | 152 |
| Full production readiness including omnichannel | 153 |
| Real campground pilot | 154-155 |
| Public/telephone/SMS launch | 156 |

## Channel parity rule

For every applicable build, acceptance criteria must explicitly state whether the function is available through:
- Web/PWA;
- IVR/DTMF;
- SMS/MMS;
- staff-assisted call;
- secure-link handoff.

An inherently visual task such as polygon drawing may be marked graphical-only, but its resulting operational object must still be addressable through non-visual channels by site/asset identifier where meaningful.


| Universal contextual ⓘ help for sections/forms/input sheets | 003, then required by every applicable UI build |
| Inline help plus full external/help-centre article | 003, then maintained with each applicable UI build |
| Admin data freshness, manual refresh and refresh-state tracking | 003, 007, 148, 153 |
| Persisted source watermark / stale / failed refresh metadata | 003, 007, 148 |
