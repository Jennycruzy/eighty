# Synthetic document fixtures

`pay.png` is a generated record with made-up pay facts and no personal details. `pay.heic` contains the same picture, encoded by libheif.

To recreate HEIC:

```sh
docker build -f tests/fixtures/documents/heic.Dockerfile -t eighty-heic-fixture .
docker run --rm --cpus=1 --memory=512m -v "$PWD/tests/fixtures/documents:/documents" eighty-heic-fixture -q 80 /documents/pay.png -o /documents/pay.heic
```

Other images and the two-page PDF are generated in the checks. They contain no real member data.
