from app.core.exceptions import InvalidOperationException


class VerifyRequiredFieldsService:
    def execute(
        self,
        *,
        schema_fields: dict,
        answered_ids: set[str],
        signed_field_ids: set[str],
    ) -> None:
        # compute
        missing_required = []
        missing_signatures = []
        for field_id, field_def in schema_fields.items():
            if not field_def.get("required", False):
                continue

            if field_def.get("type") == "signature":
                missing_signatures.append(field_id)
            elif field_id not in answered_ids:
                missing_required.append(field_id)

        # verify
        if missing_required:
            raise InvalidOperationException(
                f"Missing required answers: {', '.join(missing_required)}"
            )

        unsigned = [f for f in missing_signatures if f not in signed_field_ids]
        if unsigned:
            raise InvalidOperationException(
                f"Missing required signatures: {', '.join(unsigned)}"
            )
