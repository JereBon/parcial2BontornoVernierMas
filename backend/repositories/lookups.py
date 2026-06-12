from sqlmodel import Session, select
from ..models import Rol, EstadoPedido, FormaPago, UnidadMedida


class RolRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_by_codigo(self, codigo: str) -> Rol | None:
        return self.session.exec(select(Rol).where(Rol.codigo == codigo)).first()

    def get_by_codigos(self, codigos: list[str]) -> list[Rol]:
        if not codigos:
            return []
        return list(self.session.exec(select(Rol).where(Rol.codigo.in_(codigos))).all())

    def list_all(self) -> list[Rol]:
        return list(self.session.exec(select(Rol).order_by(Rol.codigo)).all())


class EstadoPedidoRepository:
    def __init__(self, session: Session):
        self.session = session

    def get(self, id_: int) -> EstadoPedido | None:
        return self.session.get(EstadoPedido, id_)

    def get_by_codigo(self, codigo: str) -> EstadoPedido | None:
        return self.session.exec(
            select(EstadoPedido).where(EstadoPedido.codigo == codigo)
        ).first()

    def list_all(self) -> list[EstadoPedido]:
        return list(
            self.session.exec(select(EstadoPedido).order_by(EstadoPedido.orden)).all()
        )


class FormaPagoRepository:
    def __init__(self, session: Session):
        self.session = session

    def get(self, id_: int) -> FormaPago | None:
        return self.session.get(FormaPago, id_)

    def get_by_codigo(self, codigo: str) -> FormaPago | None:
        return self.session.exec(
            select(FormaPago).where(FormaPago.codigo == codigo)
        ).first()

    def list_all(self) -> list[FormaPago]:
        return list(
            self.session.exec(
                select(FormaPago).where(FormaPago.habilitado == True).order_by(FormaPago.codigo)
            ).all()
        )


class UnidadMedidaRepository:
    def __init__(self, session: Session):
        self.session = session

    def get(self, id_: int) -> UnidadMedida | None:
        return self.session.get(UnidadMedida, id_)

    def list_all(self) -> list[UnidadMedida]:
        return list(
            self.session.exec(select(UnidadMedida).order_by(UnidadMedida.nombre)).all()
        )
