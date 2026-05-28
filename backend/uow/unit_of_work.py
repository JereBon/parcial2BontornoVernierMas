from sqlmodel import Session


class UnitOfWork:
    def __init__(self, session: Session):
        self.session = session
        self._committed = False

    def commit(self) -> None:
        self.session.commit()
        self._committed = True

    def rollback(self) -> None:
        self.session.rollback()

    def __enter__(self) -> "UnitOfWork":
        return self

    def __exit__(self, exc_type, exc_val, traceback) -> None:
        if exc_type is not None:
            self.rollback()
            return
        if not self._committed:
            self.commit()
