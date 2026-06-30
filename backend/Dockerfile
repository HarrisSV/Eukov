FROM golang:1.25-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o /server ./cmd/server

FROM alpine:3.21

WORKDIR /app

RUN apk add --no-cache ca-certificates

COPY --from=builder /server /app/server

RUN mkdir -p /app/uploads/dockets /app/uploads/documents /app/uploads/temp

EXPOSE 8080

CMD ["/app/server"]
