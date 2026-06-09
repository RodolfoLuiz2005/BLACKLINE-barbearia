# Script para corrigir todos os repositorios Git no Windows
# Problema: Line endings (CRLF vs LF)

# Configuracao global do Git para Windows
Write-Host "Configurando Git globalmente..." -ForegroundColor Cyan
git config --global core.safecrlf false
git config --global core.autocrlf true
git config --global core.filemode false

# Define a pasta raiz onde seus repos estao
$pastaRaiz = "C:\Users\rodol\OneDrive\Documents\projetos\projetos"

Write-Host "Acessando: $pastaRaiz" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Lista de todos os seus repositorios (SEM HelenaADV)
$repos = @(
    "BLACKLINE-barbearia",
    "cervejaria",
    "confeitaria",
    "conviteDeAniversario",
    "curso-gustavoGuanabara",
    "java",
    "Lanchonete",
    "ola-mundo",
    "portifolio",
    "restaurante1",
    "salao-de-beleza"
)

$reposCorrigidos = 0
$reposNaoEncontrados = 0

# Percorre cada repositorio
foreach ($repo in $repos) {
    $caminhoRepo = Join-Path $pastaRaiz $repo
    
    if (Test-Path $caminhoRepo) {
        Write-Host "Corrigindo: $repo" -ForegroundColor Yellow
        
        try {
            cd $caminhoRepo
            
            # Remove do staging
            git reset HEAD 2>&1 | Out-Null
            
            # Limpa arquivos nao rastreados
            git clean -fd 2>&1 | Out-Null
            
            # Remove do cache
            git rm --cached -r . 2>&1 | Out-Null
            
            # Reseta para o ultimo commit
            git reset --hard HEAD 2>&1 | Out-Null
            
            Write-Host "   $repo corrigido com sucesso!" -ForegroundColor Green
            $reposCorrigidos++
        }
        catch {
            Write-Host "   Erro ao corrigir $repo" -ForegroundColor Red
        }
    } else {
        Write-Host "   Pasta nao encontrada: $repo" -ForegroundColor Red
        $reposNaoEncontrados++
    }
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Correcao concluida!" -ForegroundColor Cyan
Write-Host "Repositorios corrigidos: $reposCorrigidos" -ForegroundColor Green
Write-Host "Repositorios nao encontrados: $reposNaoEncontrados" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Cyan

Read-Host "Pressione ENTER para fechar"
