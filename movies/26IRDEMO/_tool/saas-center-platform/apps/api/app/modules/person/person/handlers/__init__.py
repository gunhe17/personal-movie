from .create_person import create_person_handler
from .get_person import get_person_handler
from .list_persons import list_persons_handler
from .update_person import update_person_handler
from .delete_person import delete_person_handler

__all__ = [
    "create_person_handler",
    "get_person_handler",
    "list_persons_handler",
    "update_person_handler",
    "delete_person_handler",
]
